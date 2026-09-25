import { useState } from 'react';
import { openMediaPicker } from 'zmp-sdk';
import { Button } from 'zmp-ui';

import { rejectMessages } from '@/features/listings/draft/reject-messages';
import {
  FileFormat,
  IMAGE_HEAD_BYTES,
  readImageDimensions,
  sniffFormat,
} from '@/features/media/file-header';
import {
  type ByteReader,
  describeCodec,
  pickedPaths,
  rangeReaderFor,
} from '@/features/media/lab/byte-access';
import { createStageBreadcrumb } from '@/features/media/lab/stage-breadcrumb';
import {
  checkImage,
  checkVideoLength,
  formatProblem,
  MediaKind,
  MIB,
  originalVideoProblem,
  shouldConvertVideo,
} from '@/features/media/media-limits';
import { readVideoMetadata } from '@/features/media/video-metadata';

/**
 * openMediaPicker for a photo or a video, with or without silentRequest, then reads what it
 * returns WITHOUT loading the whole file: a photo by its first 256 KB (format and size from
 * the header; mediabunny only reads audio and video), a video with mediabunny over HTTP
 * range requests. Each step leaves a breadcrumb (stage-breadcrumb.ts): if Zalo reloads the
 * mini app, the next open says which step it died in.
 */

type PickerType = 'photo' | 'video' | 'zcamera_photo' | 'zcamera_video';

const TYPES: { type: PickerType; label: string }[] = [
  { type: 'photo', label: 'Ảnh' },
  { type: 'video', label: 'Video' },
  { type: 'zcamera_photo', label: 'Chụp' },
  { type: 'zcamera_video', label: 'Quay' },
];

/** null leaves compressLevel out, so the SDK picks its own default. */
const COMPRESS_LEVELS = [null, 0, 1, 2, 3] as const;
type CompressLevel = (typeof COMPRESS_LEVELS)[number];

const compressOptionValue = (level: CompressLevel) => (level === null ? 'none' : String(level));

const compressLevelFrom = (value: string) =>
  COMPRESS_LEVELS.find((level) => compressOptionValue(level) === value) ?? null;

const compressLabels: Record<string, string> = {
  none: 'không truyền',
  '0': '0 (ảnh gốc)',
  '1': '1 (nén nhẹ)',
  '2': '2 (nén vừa)',
  '3': '3 (nén cao)',
};

const isVideoType = (type: PickerType) => type === 'video' || type === 'zcamera_video';

const breadcrumb = createStageBreadcrumb('medialab.pickerProbeStage');

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function probePhoto(read: ByteReader, size: number) {
  const started = Date.now();
  const head = new Uint8Array(await read(0, IMAGE_HEAD_BYTES));
  const format = sniffFormat(head);
  const dimensions = readImageDimensions(head);
  const problem = formatProblem(MediaKind.Image, format) ?? checkImage(size, dimensions);
  return [
    `  ↳ header · ${Date.now() - started} ms · ${format === FileFormat.Unknown ? 'không rõ định dạng' : format}`,
    `  ↳ kích thước · ${dimensions ? `${dimensions.width} × ${dimensions.height}` : 'không đọc được'}`,
    `  ↳ L4 sẽ · ${problem ? `từ chối: ${rejectMessages[problem]}` : 'nhận, tối ưu trong worker'}`,
  ];
}

async function probeVideo(path: string, size: number) {
  const started = Date.now();
  const meta = await readVideoMetadata(path);
  const facts = { ...meta, bytes: size };
  const problem = checkVideoLength(meta.durationMs) ?? originalVideoProblem(facts);
  const plan = shouldConvertVideo(facts) ? 'chuyển 720p nếu máy làm được' : 'gửi bản gốc';
  return [
    `  ↳ mediabunny · ${Date.now() - started} ms · ${meta.mimeType}`,
    `  ↳ codec · ${describeCodec(meta.videoCodec)} · audio ${meta.audioCodecs.join(', ') || 'không có'}`,
    `  ↳ khung hình · ${meta.width ?? '?'} × ${meta.height ?? '?'} · ${
      meta.durationMs === null ? '? s' : `${(meta.durationMs / 1000).toFixed(1)} s`
    } · xoay ${meta.rotation}°`,
    `  ↳ L4 sẽ · ${plan}${problem ? `; bản gốc bị từ chối: ${rejectMessages[problem]}` : ''}`,
  ];
}

/** Every line about one returned path, reading only what each step needs. */
async function probePath(path: string, index: number, type: PickerType) {
  const lines = [`  [${index + 1}] ${path}`];
  let step = 'dung lượng';
  try {
    breadcrumb.write(`file ${index + 1}: ${step}`);
    const { read, size, rangeSupported, contentType } = await rangeReaderFor(path);
    lines.push(
      `  ↳ dung lượng · ${size ? `${(size / MIB).toFixed(2)} MB` : 'không rõ'} · ${contentType || 'không có mime'} · Range ${rangeSupported ? 'có' : 'KHÔNG'}`,
    );
    if (!rangeSupported) {
      lines.push('  ↳ dừng: không đọc từng đoạn được, đọc tiếp sẽ tải cả file');
      return lines;
    }

    step = isVideoType(type) ? 'mediabunny' : 'header ảnh';
    breadcrumb.write(`file ${index + 1}: ${step}`);
    lines.push(
      ...(isVideoType(type) ? await probeVideo(path, size) : await probePhoto(read, size)),
    );
  } catch (error) {
    lines.push(`  ↳ LỖI ở bước ${step} · ${errorText(error)}`);
  }
  return lines;
}

export default function PickerProbeLab() {
  // picker options
  const [type, setType] = useState<PickerType>('photo');
  const [silentRequest, setSilentRequest] = useState(true);
  const [compressLevel, setCompressLevel] = useState<CompressLevel>(0);
  const [maxSelectItem, setMaxSelectItem] = useState(1);

  // results
  const [lines, setLines] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [crashedStage] = useState(breadcrumb.read);

  const isPhoto = !isVideoType(type);

  const handleOpen = async () => {
    const args = {
      type,
      silentRequest,
      ...(isPhoto && compressLevel !== null ? { compressLevel } : {}),
      ...(type === 'photo' ? { maxSelectItem } : {}),
    };
    const header = `openMediaPicker ${JSON.stringify(args)}`;
    setIsBusy(true);
    setLines([header, '  … đang chờ picker']);

    const started = Date.now();
    breadcrumb.write(`picker đang mở ${JSON.stringify(args)}`);
    try {
      const response = await openMediaPicker(args);
      const paths = pickedPaths(response.data);
      const result = [
        header,
        `  picker trả lời sau ${Date.now() - started} ms · ${paths.length} file`,
      ];
      setLines(result);

      for (const [index, path] of paths.entries()) {
        result.push(...(await probePath(path, index, type)));
        setLines([...result]);
      }
    } catch (error) {
      setLines([header, `  picker lỗi sau ${Date.now() - started} ms · ${errorText(error)}`]);
    } finally {
      // Reaching here means nothing crashed; the breadcrumb is only for a reload.
      breadcrumb.clear();
      setIsBusy(false);
    }
  };

  return (
    <section className="marketplace-card mt-3 p-4">
      <p className="field-heading m-0">openMediaPicker + silentRequest, đọc bằng mediabunny</p>
      <p className="m-0 mt-1 text-sm text-slate-500">
        Chỉ chạy trong Zalo. Không tải cả file: ảnh đọc 256 KB đầu, video đọc qua range request.
      </p>
      {crashedStage && (
        <p className="m-0 mt-2 text-sm font-semibold text-red-600">
          Lần trước app bị tải lại ở: {crashedStage}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {TYPES.map((option) => (
          <Button
            key={option.type}
            size="small"
            variant={option.type === type ? 'primary' : 'secondary'}
            disabled={isBusy}
            onClick={() => setType(option.type)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={silentRequest}
            onChange={(event) => setSilentRequest(event.target.checked)}
          />
          silentRequest
        </label>
        {isPhoto && (
          <label className="flex items-center gap-2">
            compressLevel
            <select
              value={compressOptionValue(compressLevel)}
              onChange={(event) => setCompressLevel(compressLevelFrom(event.target.value))}
            >
              {COMPRESS_LEVELS.map((level) => (
                <option key={compressOptionValue(level)} value={compressOptionValue(level)}>
                  {compressLabels[compressOptionValue(level)]}
                </option>
              ))}
            </select>
          </label>
        )}
        {type === 'photo' && (
          <label className="flex items-center gap-2">
            maxSelectItem
            <select
              value={maxSelectItem}
              onChange={(event) => setMaxSelectItem(Number(event.target.value))}
            >
              {[1, 5, 10].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <Button className="mt-3" size="small" disabled={isBusy} onClick={() => void handleOpen()}>
        Mở picker
      </Button>

      {lines.length > 0 && (
        <pre className="m-0 mt-3 whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-xs">
          {lines.join('\n')}
        </pre>
      )}
    </section>
  );
}
