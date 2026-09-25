import { useEffect, useRef, useState } from 'react';
import { Button } from 'zmp-ui';

import { sniffBlobFormat } from '@/features/media/file-header';

/**
 * Encodes one photo with this device's own canvas encoders and lets you flip
 * between the results at the same zoom and scroll position, to judge by eye
 * what the SSIM numbers in plans/presentation-notes.md say. The server's
 * mozjpeg is not available here; it is about 20% smaller than this JPEG at
 * the same quality setting.
 */

type VariantSpec = { key: string; label: string; type: string; quality?: number };

type Variant = VariantSpec & {
  url: string | null;
  bytes: number;
  encodeMs: number;
  /** The format the bytes really are; differs from `type` when the device cannot encode it. */
  actualType: string;
};

const SPECS: VariantSpec[] = [
  { key: 'png', label: 'Tham chiếu PNG', type: 'image/png' },
  { key: 'jpeg75', label: 'JPEG 0.75', type: 'image/jpeg', quality: 0.75 },
  { key: 'jpeg85', label: 'JPEG 0.85', type: 'image/jpeg', quality: 0.85 },
  { key: 'jpeg92', label: 'JPEG 0.92', type: 'image/jpeg', quality: 0.92 },
  { key: 'webp80', label: 'WebP 0.80', type: 'image/webp', quality: 0.8 },
  { key: 'webp90', label: 'WebP 0.90', type: 'image/webp', quality: 0.9 },
];

const ZOOMS = [1, 2, 4] as const;
// Candidate long edges for the upload. The image is always shown at the same
// on-screen size, so zooming shows how much detail each one keeps.
const EDGES = [1024, 1280, 1600, 2048] as const;
type Edge = (typeof EDGES)[number];

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeVariants(file: File, edge: Edge): Promise<Variant[]> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2d context unavailable');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const variants: Variant[] = [];
  for (const spec of SPECS) {
    const started = performance.now();
    const blob = await toBlob(canvas, spec.type, spec.quality);
    const encodeMs = performance.now() - started;
    const actualType = blob ? await sniffBlobFormat(blob) : 'none';
    const isReal = actualType === spec.type;
    variants.push({
      ...spec,
      url: blob && isReal ? URL.createObjectURL(blob) : null,
      bytes: blob?.size ?? 0,
      encodeMs,
      actualType,
    });
  }

  canvas.width = 1;
  canvas.height = 1;
  return variants;
}

function revokeAll(variants: Variant[]) {
  variants.forEach((variant) => variant.url && URL.revokeObjectURL(variant.url));
}

export default function FormatCompare() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [edge, setEdge] = useState<Edge>(1280);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [activeKey, setActiveKey] = useState('jpeg85');
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(2);
  const [status, setStatus] = useState<string | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);

  // Object URLs hold the encoded bytes until revoked.
  useEffect(() => () => revokeAll(variants), [variants]);

  const encode = async (picked: File, nextEdge: Edge) => {
    // One encode at a time: two full-size decodes at once is a memory spike of the lab's
    // own making, and a slower earlier encode would land under the newer size's label.
    setIsEncoding(true);
    setStatus('Đang encode…');
    try {
      setVariants(await encodeVariants(picked, nextEdge));
      setStatus(
        `${picked.name} · gốc ${(picked.size / 1024).toFixed(0)} KB · cạnh dài ${nextEdge} px`,
      );
    } catch (error) {
      setStatus(`Lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsEncoding(false);
    }
  };

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) {
      return;
    }
    setFile(picked);
    void encode(picked, edge);
  };

  const handleEdge = (nextEdge: Edge) => {
    setEdge(nextEdge);
    if (file) {
      void encode(file, nextEdge);
    }
  };

  const active = variants.find((variant) => variant.key === activeKey && variant.url);

  return (
    <section className="marketplace-card mt-3 p-4">
      <p className="field-heading m-0">So sánh định dạng JPEG / WebP</p>
      <p className="m-0 mt-1 text-sm text-slate-500">
        Ảnh được thu về cạnh dài đã chọn rồi encode bằng chính máy này. Phóng to rồi chạm qua lại
        các bản (hoặc đổi cạnh dài) để thấy khác biệt ở cùng một chỗ.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="small" disabled={isEncoding} onClick={() => inputRef.current?.click()}>
          Chọn ảnh
        </Button>
        {ZOOMS.map((level) => (
          <Button
            key={level}
            size="small"
            variant={zoom === level ? 'primary' : 'secondary'}
            onClick={() => setZoom(level)}
          >
            {level === 1 ? 'Vừa khung' : `${level}x`}
          </Button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {EDGES.map((value) => (
          <Button
            key={value}
            size="small"
            variant={edge === value ? 'primary' : 'secondary'}
            disabled={isEncoding}
            onClick={() => handleEdge(value)}
          >
            {value} px
          </Button>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="absolute h-0 w-0 opacity-0"
        onChange={handlePick}
      />

      {status && <p className="m-0 mt-2 text-sm">{status}</p>}

      {variants.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {variants.map((variant) => (
            <button
              key={variant.key}
              type="button"
              disabled={!variant.url}
              className={`rounded-full border px-3 py-1 text-xs ${
                variant.key === activeKey
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              } disabled:opacity-50`}
              onClick={() => setActiveKey(variant.key)}
            >
              {variant.label} ·{' '}
              {variant.url
                ? `${(variant.bytes / 1024).toFixed(0)} KB · ${Math.round(variant.encodeMs)} ms`
                : `máy không encode được (ra ${variant.actualType})`}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="mt-3 h-[60vh] overflow-auto rounded border border-slate-200 bg-slate-100">
          <img
            src={active.url ?? undefined}
            alt={active.label}
            className="block max-w-none"
            style={{ width: `${zoom * 100}%` }}
          />
        </div>
      )}
    </section>
  );
}
