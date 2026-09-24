import { useCallback, useRef, useState } from 'react';
import { openMediaPicker } from 'zmp-sdk';
import { Button, Page } from 'zmp-ui';
import MobilePageHeader from '@/components/mobile-page-header';
import FormatCompare from '@/features/media/lab/format-compare';
import ImagePoolBench from '@/features/media/lab/image-pool-bench';
import { describeCodec, inspectMp4 } from '@/features/media/video-probe';

/**
 * Stripped to the bone on purpose.
 *
 * Everything that touched the picked file is gone: no fetch, no Blob, no <video> element,
 * no mp4 box scan, no canvas, no worker, no benchmark. What is left between tapping a
 * button and the app dying is one await on openMediaPicker.
 *
 * If a large video still reloads the app from here, none of our code can be the cause,
 * because there is no longer any of our code in the way.
 *
 * The one thing that is not the picker call is the sessionStorage breadcrumb below. It
 * stays because a crash takes the console with it, and the breadcrumb is the only way to
 * tell afterwards whether we died before or after the picker answered.
 */

const STAGE_KEY = 'medialab.lastStage';

function markStage(stage: string) {
  try {
    sessionStorage.setItem(STAGE_KEY, `${stage} @ ${new Date().toLocaleTimeString()}`);
  } catch {
    // Private mode. Not worth failing the test over.
  }
}

function readStage(): string | null {
  try {
    return sessionStorage.getItem(STAGE_KEY);
  } catch {
    return null;
  }
}

type PickerArgs = {
  type: 'video' | 'zcamera_video';
  silentRequest?: boolean;
  editView?: { enable?: boolean };
};

type Variant = { key: string; label: string; args: PickerArgs };

const VARIANTS: Variant[] = [
  { key: 'gallery', label: 'Thư viện', args: { type: 'video' } },
  { key: 'record', label: 'Quay', args: { type: 'zcamera_video' } },
  {
    key: 'record-silent',
    label: 'Quay + silentRequest',
    args: { type: 'zcamera_video', silentRequest: true },
  },
  {
    key: 'record-noedit',
    label: 'Quay + tắt editView',
    args: { type: 'zcamera_video', editView: { enable: false } },
  },
];

/** Prints whatever came back, without any parsing of ours that could hide the shape. */
function describe(value: unknown): string {
  const kind = Array.isArray(value) ? 'array' : typeof value;
  let body: string;
  try {
    body = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    body = String(value);
  }
  return `${kind} · ${(body ?? 'undefined').slice(0, 400)}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * The head tells us the container. Reading it at all tells us the File is lazy.
 *
 * This is the whole point of the <input type="file"> route: the browser hands back a File
 * handle, not the bytes - which is exactly what openMediaPicker will not do, because it
 * copies the file into a cache path first and dies doing it.
 */
async function peekHead(file: File): Promise<string> {
  const head = await file.slice(0, 32).arrayBuffer();
  const view = new DataView(head);
  const type = String.fromCharCode(
    view.getUint8(4),
    view.getUint8(5),
    view.getUint8(6),
    view.getUint8(7),
  );
  const brand = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11),
  );
  return type === 'ftyp' ? `ftyp ${brand}` : `không phải ftyp (${type})`;
}

/**
 * Reading the head proves nothing on its own - a stream would answer that too.
 *
 * Multipart upload needs RANDOM access: jump to the tail, then to an arbitrary offset in
 * the middle, and pull a part-sized chunk without the other 700 MB coming along. If a 4 MB
 * slice from the middle of a 776 MB file lands in a fraction of a second and the app is
 * still alive afterwards, the file really is a handle on disk and we can upload it part by
 * part straight to S3.
 */
async function probeRandomAccess(file: File): Promise<string[]> {
  const lines: string[] = [];

  const tailStarted = Date.now();
  const tail = await file.slice(Math.max(0, file.size - 32), file.size).arrayBuffer();
  lines.push(`  ↳ 32 byte cuối · ${Date.now() - tailStarted} ms · ${tail.byteLength} byte`);

  const partSize = 4 * 1024 * 1024;
  const middle = Math.max(0, Math.floor(file.size / 2) - partSize / 2);
  const midStarted = Date.now();
  const part = await file.slice(middle, middle + partSize).arrayBuffer();
  const midMs = Date.now() - midStarted;
  const mbPerSecond = midMs > 0 ? (part.byteLength / 1024 / 1024 / (midMs / 1000)).toFixed(0) : '?';
  lines.push(
    `  ↳ 4 MB giữa file · ${midMs} ms · ${(part.byteLength / 1024 / 1024).toFixed(1)} MB · ~${mbPerSecond} MB/s`,
  );

  return lines;
}

/**
 * Reads the picture size and length from a metadata-only load.
 *
 * Apple caps what the web camera is allowed to record - an old report on the developer
 * forums measured 480x360 with fixed focus, and Apple never answered it. This is how we
 * find out what the cap is on this phone today, and it is the number that decides whether
 * we should send sellers to the Camera app instead of the in-app recorder.
 *
 * preload="metadata" reads the header, not the media data, and the object URL is revoked
 * either way so nothing is left holding the file.
 */
function readVideoShape(file: File): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const done = (text: string) => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(text);
    };
    video.onloadedmetadata = () => {
      done(`${video.videoWidth} x ${video.videoHeight} · ${video.duration.toFixed(1)} s`);
    };
    video.onerror = () => done('không đọc được metadata');
    window.setTimeout(() => done('quá hạn 5 s'), 5000);
    video.src = url;
  });
}

export default function MediaLabPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastStage, setLastStage] = useState<string | null>(readStage);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const startedAt = useRef(0);
  const closedAt = useRef(0);
  const source = useRef('input');

  const openInput = useCallback((which: 'camera' | 'library') => {
    source.current = which === 'camera' ? 'input capture' : 'input thư viện';
    startedAt.current = Date.now();
    closedAt.current = 0;
    markStage(`${source.current}: mở`);

    // The wall clock from tap to change is mostly the user recording or browsing, which
    // tells us nothing. The page regains focus when the native sheet dismisses, so the gap
    // between that moment and the change event is the part we actually care about: what iOS
    // spends copying or exporting the file before it hands us a File.
    const onBack = () => {
      if (closedAt.current === 0) closedAt.current = Date.now();
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('pageshow', onBack);
    };
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('pageshow', onBack);

    const input = which === 'camera' ? cameraInput.current : libraryInput.current;
    if (input) {
      // Clear the value so picking the same file twice still fires change.
      input.value = '';
      input.click();
    }
  }, []);

  const onFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const elapsed = Date.now() - startedAt.current;
    const label = source.current;
    const file = event.target.files?.[0];
    markStage(`${label}: change đã bắn`);
    if (!file) {
      setLines((current) => [`${label} · ${elapsed} ms · không có file (huỷ)`, ...current]);
      return;
    }
    const copyMs = closedAt.current > 0 ? `${Date.now() - closedAt.current} ms copy` : 'copy ?';
    setLines((current) => [
      `${label} · ${elapsed} ms tổng · ${copyMs} · ${file.name} · ${formatBytes(file.size)} · ${file.type || 'không có mime'}`,
      ...current,
    ]);
    try {
      markStage(`${label}: đọc 32 byte đầu`);
      const startedPeek = Date.now();
      const head = await peekHead(file);
      setLines((current) => [
        `  ↳ 32 byte đầu · ${Date.now() - startedPeek} ms · ${head}`,
        ...current,
      ]);
      markStage(`${label}: đọc kích thước khung hình`);
      const shapeStarted = Date.now();
      const shape = await readVideoShape(file);
      setLines((current) => [
        `  ↳ khung hình · ${Date.now() - shapeStarted} ms · ${shape}`,
        ...current,
      ]);

      markStage(`${label}: đọc ngẫu nhiên`);
      const probes = await probeRandomAccess(file);
      setLines((current) => [...probes.reverse(), ...current]);

      // Now that slicing is proven cheap, the box scan is safe: it reads headers and the
      // moov atom, never the media data. ftyp qt only names the container - the codec
      // inside decides whether Android can play the clip at all.
      markStage(`${label}: quét box`);
      const scanStarted = Date.now();
      const info = await inspectMp4(
        (start, end) => file.slice(start, end).arrayBuffer(),
        file.size,
      );
      setLines((current) => [
        `  ↳ box · ${Date.now() - scanStarted} ms · ${info.brand} · moov ${formatBytes(info.moovBytes)} · ${
          info.faststart ? 'faststart CÓ' : 'faststart KHÔNG'
        }`,
        `  ↳ codec · ${info.videoCodecs.map(describeCodec).join(', ') || 'không thấy video track'} · audio ${
          info.audioCodecs.join(',') || 'không có'
        }`,
        ...current,
      ]);
      markStage(`${label}: xong`);
    } catch (error) {
      const message = error instanceof Error ? error.message : describe(error);
      setLines((current) => [`  ↳ đọc 32 byte đầu LỖI ${message}`, ...current]);
      markStage(`${label}: lỗi khi đọc`);
    }
  }, []);

  const run = useCallback(async (variant: Variant) => {
    setBusy(true);
    const started = Date.now();
    markStage(`${variant.key}: mở picker`);
    try {
      const response = await openMediaPicker(variant.args);
      markStage(`${variant.key}: picker đã trả lời`);
      const elapsed = Date.now() - started;
      setLines((current) => [
        `${variant.label} · ${elapsed} ms · ${describe(response)}`,
        ...current,
      ]);
      markStage(`${variant.key}: xong`);
    } catch (error) {
      const elapsed = Date.now() - started;
      const message = error instanceof Error ? error.message : describe(error);
      setLines((current) => [`${variant.label} · ${elapsed} ms · LỖI ${message}`, ...current]);
      markStage(`${variant.key}: lỗi`);
    } finally {
      setBusy(false);
    }
  }, []);

  const clearStage = useCallback(() => {
    try {
      sessionStorage.removeItem(STAGE_KEY);
    } catch {
      // Nothing to clear.
    }
    setLastStage(null);
    setLines([]);
  }, []);

  return (
    <Page className="marketplace-page">
      <MobilePageHeader title="Media lab" showBack fallbackPath="/profile" />
      <main className="marketplace-content marketplace-content-with-header">
        {lastStage && (
          <section className="marketplace-card p-4">
            <p className="m-0 text-sm font-semibold text-red-600">
              Lần chạy trước dừng ở: {lastStage}
            </p>
          </section>
        )}

        <FormatCompare />

        <ImagePoolBench />

        <section className="marketplace-card mt-3 p-4">
          <p className="field-heading m-0">Chỉ gọi openMediaPicker, không đụng vào file</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {VARIANTS.map((variant) => (
              <Button
                key={variant.key}
                size="small"
                disabled={busy}
                onClick={() => void run(variant)}
              >
                {variant.label}
              </Button>
            ))}
            <Button size="small" variant="secondary" disabled={busy} onClick={clearStage}>
              Xoá kết quả
            </Button>
          </div>
        </section>

        <section className="marketplace-card mt-3 p-4">
          <p className="field-heading m-0">Đường khác: input type=file, không qua SDK</p>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Trình duyệt trả về File handle chứ không phải byte. Nếu file 500 MB hiện ra ngay và app
            không chết thì mình upload từng slice thẳng lên S3 được.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="small" disabled={busy} onClick={() => openInput('camera')}>
              Quay (capture)
            </Button>
            <Button size="small" disabled={busy} onClick={() => openInput('library')}>
              Chọn file
            </Button>
          </div>
          <input
            ref={cameraInput}
            type="file"
            accept="video/*"
            capture="environment"
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
            onChange={(event) => void onFile(event)}
          />
          <input
            ref={libraryInput}
            type="file"
            accept="video/*"
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
            onChange={(event) => void onFile(event)}
          />
        </section>

        <section className="marketplace-card mt-3 p-4">
          {lines.length === 0 ? (
            <p className="m-0 text-sm text-slate-500">Chưa có kết quả.</p>
          ) : (
            lines.map((line, index) => (
              <p key={index} className="m-0 mt-1 break-all text-sm">
                {line}
              </p>
            ))
          )}
        </section>
      </main>
    </Page>
  );
}
