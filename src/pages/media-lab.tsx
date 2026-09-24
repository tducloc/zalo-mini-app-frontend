import { useCallback, useEffect, useRef, useState } from 'react';
import { openMediaPicker } from 'zmp-sdk';
import { Button, Page } from 'zmp-ui';
import MobilePageHeader from '@/components/mobile-page-header';
import FormatCompare from '@/features/media/lab/format-compare';
import ImagePoolBench from '@/features/media/lab/image-pool-bench';
import { type ByteReader, describeCodec, rangeReaderFor } from '@/features/media/lab/byte-access';
import { readVideoMetadata } from '@/features/media/video-metadata';

/**
 * Measures the two ways to pick a video: Zalo's openMediaPicker and <input type="file">.
 *
 * The SDK route first awaits the picker and nothing else, so a large video that reloads
 * the app there cannot be our code's fault. Only after the picker has answered does the
 * page read the returned path (size, first bytes, codec), through range requests, so the
 * probe never pulls a whole video into memory.
 *
 * The sessionStorage breadcrumb stays because a crash takes the console with it: it is the
 * only way to tell afterwards which step we died in.
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
  type: 'video' | 'photo' | 'zcamera_video';
  silentRequest?: boolean;
  editView?: { enable?: boolean };
};

type Variant = { key: string; label: string; args: PickerArgs };

const VARIANTS: Variant[] = [
  { key: 'gallery', label: 'Thư viện', args: { type: 'video' } },
  { key: 'photo', label: 'Ảnh', args: { type: 'photo' } },
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

const MIDDLE_PART_BYTES = 4 * 1024 * 1024;

/** Where the bytes of a picked video come from; both pickers are logged through this. */
interface VideoSource {
  pathLine: string;
  size: number;
  mime: string;
  /** How reads reach the bytes: a File on disk, or HTTP range requests on a path. */
  access: string;
  canReadRanges: boolean;
  read: ByteReader;
  /** What readVideoMetadata reads: the File itself, or the path over HTTP. */
  metadataSource: Blob | string;
}

function fileSource(file: File, inputValue: string): VideoSource {
  // Browsers never expose the real path: input.value is "C:\fakepath\<name>" by spec,
  // and webkitRelativePath is only set when picking a folder.
  return {
    pathLine: `value="${inputValue}" · relativePath="${file.webkitRelativePath}" · sửa lúc ${new Date(
      file.lastModified,
    ).toLocaleString('vi-VN')}`,
    size: file.size,
    mime: file.type,
    access: 'File trên đĩa (slice)',
    canReadRanges: true,
    read: (start, end) => file.slice(start, end).arrayBuffer(),
    metadataSource: file,
  };
}

/** openMediaPicker answers with a path, not a File: every read is a range request on it. */
async function pathSource(path: string): Promise<VideoSource> {
  const { read, size, rangeSupported, contentType } = await rangeReaderFor(path);
  return {
    pathLine: path,
    size,
    mime: contentType,
    access: rangeSupported ? 'HTTP Range CÓ (206)' : 'HTTP Range KHÔNG',
    canReadRanges: rangeSupported && size > 0,
    read,
    metadataSource: path,
  };
}

function fourCC(view: DataView, offset: number) {
  return String.fromCharCode(...[0, 1, 2, 3].map((index) => view.getUint8(offset + index)));
}

/**
 * The same lines, in the same order, whichever picker produced the video. Random access is
 * the point of the test: multipart upload must jump to the tail and to the middle of the
 * file without the rest of it coming along. The metadata step is the create form's own
 * check (readVideoMetadata), so the lab shows exactly what the form will see.
 */
async function probeVideoSource(source: VideoSource, stage: string): Promise<string[]> {
  const lines = [
    `  ↳ đường dẫn · ${source.pathLine}`,
    `  ↳ dung lượng · ${source.size ? `${formatBytes(source.size)} (${source.size} byte)` : 'không rõ'} · ${
      source.mime || 'không có mime'
    } · ${source.access}`,
  ];
  if (!source.canReadRanges) {
    lines.push('  ↳ dừng: không đọc từng đoạn được, đọc tiếp sẽ tải cả file');
    return lines;
  }

  let step = '32 byte đầu';
  try {
    markStage(`${stage}: đọc 32 byte đầu`);
    let started = Date.now();
    const head = new DataView(await source.read(0, 32));
    const kind =
      fourCC(head, 4) === 'ftyp'
        ? `ftyp ${fourCC(head, 8)}`
        : `không phải ftyp (${fourCC(head, 4)})`;
    lines.push(`  ↳ 32 byte đầu · ${Date.now() - started} ms · ${kind}`);

    step = '32 byte cuối';
    markStage(`${stage}: đọc 32 byte cuối`);
    started = Date.now();
    const tail = await source.read(Math.max(0, source.size - 32), source.size);
    lines.push(`  ↳ 32 byte cuối · ${Date.now() - started} ms · ${tail.byteLength} byte`);

    step = '4 MB giữa file';
    markStage(`${stage}: đọc 4 MB giữa file`);
    const middle = Math.max(0, Math.floor(source.size / 2) - MIDDLE_PART_BYTES / 2);
    started = Date.now();
    const part = await source.read(middle, middle + MIDDLE_PART_BYTES);
    const partMs = Date.now() - started;
    const mbPerSecond =
      partMs > 0 ? (part.byteLength / 1024 / 1024 / (partMs / 1000)).toFixed(0) : '?';
    lines.push(
      `  ↳ 4 MB giữa file · ${partMs} ms · ${formatBytes(part.byteLength)} · ~${mbPerSecond} MB/s`,
    );

    step = 'metadata';
    markStage(`${stage}: đọc metadata`);
    started = Date.now();
    const meta = await readVideoMetadata(source.metadataSource);
    lines.push(
      `  ↳ metadata · ${Date.now() - started} ms · ${meta.mimeType} (mediabunny)`,
      `  ↳ codec · ${describeCodec(meta.videoCodec)} · audio ${meta.audioCodec ?? 'không có'}`,
      `  ↳ khung hình · ${meta.width ?? '?'} x ${meta.height ?? '?'} · ${
        meta.durationMs === null ? '? s' : `${(meta.durationMs / 1000).toFixed(1)} s`
      } · xoay ${meta.rotation}°`,
    );
    markStage(`${stage}: xong`);
  } catch (error) {
    const message = error instanceof Error ? error.message : describe(error);
    lines.push(`  ↳ LỖI ở bước ${step} · ${message}`);
    markStage(`${stage}: lỗi ở bước ${step}`);
  }
  return lines;
}

/** The SDK answers with paths, or with one string that may be a JSON array of them. */
function pickedPaths(data: string[] | string | undefined): string[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (!data) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.map(String) : [data];
  } catch {
    return [data];
  }
}

/** One pick: its log lines and what it picked, drawn with an <img> tag. */
interface LogBlock {
  id: number;
  lines: string[];
  previewSrcs: string[];
}

export default function MediaLabPage() {
  const [blocks, setBlocks] = useState<LogBlock[]>([]);
  const nextBlockId = useRef(0);
  // Object URLs of picked Files stay alive while their preview is on screen.
  const objectUrls = useRef<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastStage, setLastStage] = useState<string | null>(readStage);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const startedAt = useRef(0);
  const closedAt = useRef(0);
  const source = useRef('input');

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const addBlock = useCallback((lines: string[], previewSrcs: string[] = []) => {
    const id = nextBlockId.current++;
    setBlocks((current) => [{ id, lines, previewSrcs }, ...current]);
  }, []);

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

  const onFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const elapsed = Date.now() - startedAt.current;
      const label = source.current;
      const file = event.target.files?.[0];
      markStage(`${label}: change đã bắn`);
      if (!file) {
        addBlock([`${label} · ${elapsed} ms · không có file (huỷ)`]);
        return;
      }

      const copyMs = closedAt.current > 0 ? `${Date.now() - closedAt.current} ms copy` : 'copy ?';
      console.log('[media-lab] picked file', { file, value: event.target.value });
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      const details = await probeVideoSource(fileSource(file, event.target.value), label);
      addBlock([`${label} · ${elapsed} ms tổng · ${copyMs} · ${file.name}`, ...details], [url]);
    },
    [addBlock],
  );

  const run = useCallback(
    async (variant: Variant) => {
      setBusy(true);
      const started = Date.now();
      markStage(`${variant.key}: mở picker`);
      try {
        const response = await openMediaPicker(variant.args);
        markStage(`${variant.key}: picker đã trả lời`);
        const elapsed = Date.now() - started;
        console.log('[media-lab] openMediaPicker', response);
        const block = [`${variant.label} · ${elapsed} ms tổng · ${describe(response)}`];
        const paths = pickedPaths(response.data);
        // Only after the picker has answered, so the breadcrumb still tells a crash inside
        // the picker apart from one while we read the file.
        for (const path of paths) {
          try {
            block.push(...(await probeVideoSource(await pathSource(path), variant.key)));
          } catch (error) {
            const message = error instanceof Error ? error.message : describe(error);
            block.push(`  ↳ đường dẫn · ${path}`, `  ↳ LỖI ở bước dung lượng · ${message}`);
          }
        }
        addBlock(block, paths);
        markStage(`${variant.key}: xong`);
      } catch (error) {
        const elapsed = Date.now() - started;
        const message = error instanceof Error ? error.message : describe(error);
        addBlock([`${variant.label} · ${elapsed} ms · LỖI ${message}`]);
        markStage(`${variant.key}: lỗi`);
      } finally {
        setBusy(false);
      }
    },
    [addBlock],
  );

  const clearStage = useCallback(() => {
    try {
      sessionStorage.removeItem(STAGE_KEY);
    } catch {
      // Nothing to clear.
    }
    setLastStage(null);
    setBlocks([]);
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current = [];
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
          <p className="field-heading m-0">openMediaPicker, rồi đọc thông tin file qua đường dẫn</p>
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
          {blocks.length === 0 ? (
            <p className="m-0 text-sm text-slate-500">Chưa có kết quả.</p>
          ) : (
            blocks.map((block) => (
              <div key={block.id} className="border-0 border-b border-solid border-slate-200 py-2">
                {block.lines.map((line, index) => (
                  <p key={index} className="m-0 mt-1 break-all text-sm">
                    {line}
                  </p>
                ))}
                {block.previewSrcs.map((src) => (
                  <ImagePreview key={src} src={src} />
                ))}
              </div>
            ))
          )}
        </section>
      </main>
    </Page>
  );
}

/**
 * Draws the picked file with a plain <img>, to see whether the WebView can load that
 * path or File at all. A video is expected to fail here: <img> only decodes images.
 */
function ImagePreview({ src }: { src: string }) {
  const [startedAt] = useState(Date.now);
  const [status, setStatus] = useState('<img> đang tải…');

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setStatus(`<img> tải xong · ${Date.now() - startedAt} ms · ${naturalWidth} x ${naturalHeight}`);
  };

  const handleError = () => {
    setStatus(
      `<img> không hiển thị được sau ${Date.now() - startedAt} ms (video thì <img> không vẽ được)`,
    );
  };

  return (
    <div className="mt-2">
      <img
        src={src}
        alt=""
        className="block max-h-48 max-w-full rounded border border-solid border-slate-200 object-contain"
        onLoad={handleLoad}
        onError={handleError}
      />
      <p className="m-0 mt-1 break-all text-xs text-slate-500">{status}</p>
    </div>
  );
}
