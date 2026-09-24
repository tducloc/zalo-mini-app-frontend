import { useEffect, useRef, useState } from 'react';
import { Button } from 'zmp-ui';

import {
  addDraftFiles,
  clearDraftMedia,
  removeDraftMedia,
} from '@/features/listings/draft/media-intake';
import { type DraftMedia, DraftMediaStatus } from '@/features/listings/draft/media-reducer';
import { rejectMessages } from '@/features/listings/draft/reject-messages';
import { useListingDraftStore } from '@/features/listings/draft/store';
import { canConvertVideos } from '@/features/media/convert-video';
import { startFrameMeter } from '@/features/media/lab/frame-meter';
import { MediaKind } from '@/features/media/media-limits';
import { canOptimizeImages } from '@/features/media/optimize-image';

/**
 * The real create-listing pipeline (draft store + intake service, L4) on files picked here,
 * to check it on the phone: each file's state, sizes, time to ready, and the longest
 * main-thread frame while anything works. L4 gate: 10 × 24 MP photos without a crash.
 * It shares the draft with the sell page, as the form will.
 */

const MB = 1024 * 1024;

interface Timing {
  startedAt: number;
  finishedAt?: number;
}

const isWorking = (media: DraftMedia) =>
  media.status === DraftMediaStatus.Checking || media.status === DraftMediaStatus.Optimizing;

function describeDevice() {
  return [
    `Tối ưu ảnh ${canOptimizeImages ? 'có' : 'KHÔNG (gửi ảnh gốc)'}`,
    `Chuyển video ${canConvertVideos ? 'có' : 'KHÔNG (gửi video gốc)'}`,
    `cores ${navigator.hardwareConcurrency ?? '?'}`,
  ].join(' · ');
}

function describeStatus(media: DraftMedia) {
  switch (media.status) {
    case DraftMediaStatus.Checking:
      return 'Đang kiểm tra';
    case DraftMediaStatus.Rejected:
      return `Từ chối: ${rejectMessages[media.reason]}`;
    case DraftMediaStatus.Optimizing:
      return media.progress === null
        ? 'Đang tối ưu'
        : `Đang chuyển 720p ${Math.round(media.progress * 100)}%`;
    case DraftMediaStatus.ReadyToUpload: {
      const { upload } = media;
      const size = `${(upload.blob.size / MB).toFixed(2)} MB ${upload.contentType}`;
      return `Sẵn sàng · ${size} · ${upload.optimized ? 'đã tối ưu' : 'bản gốc'}`;
    }
  }
}

export default function DraftMediaLab() {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const media = useListingDraftStore((state) => state.media);

  const timings = useRef(new Map<string, Timing>());
  const [longestFrameMs, setLongestFrameMs] = useState<number | null>(null);

  const isBusy = media.some(isWorking);

  useEffect(() => {
    const now = performance.now();
    for (const item of media) {
      const timing = timings.current.get(item.id);
      if (!timing) {
        timings.current.set(item.id, { startedAt: now });
      } else if (!timing.finishedAt && !isWorking(item)) {
        timing.finishedAt = now;
      }
    }
  }, [media]);

  useEffect(() => {
    if (!isBusy) {
      return;
    }
    const stopFrameMeter = startFrameMeter();
    return () => setLongestFrameMs(stopFrameMeter());
  }, [isBusy]);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    void addDraftFiles(Array.from(event.target.files ?? []));
    // Lets the same file be picked again.
    event.target.value = '';
  };

  const secondsFor = (id: string) => {
    const timing = timings.current.get(id);
    return timing?.finishedAt ? ((timing.finishedAt - timing.startedAt) / 1000).toFixed(1) : null;
  };

  return (
    <section className="marketplace-card mt-3 p-4">
      <p className="field-heading m-0">Quy trình đăng tin thật (L4)</p>
      <p className="m-0 mt-1 text-sm text-slate-500">{describeDevice()}</p>
      <p className="m-0 mt-1 text-sm text-slate-500">
        Frame dài nhất khi đang xử lý:{' '}
        {/* 0 means no frame was drawn at all: the page was hidden while it worked. */}
        {longestFrameMs ? `${Math.round(longestFrameMs)} ms` : '–'}
        {isBusy && ' (đang đo)'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="small" onClick={() => photoInputRef.current?.click()}>
          Thêm ảnh
        </Button>
        <Button size="small" onClick={() => videoInputRef.current?.click()}>
          Thêm video
        </Button>
        <Button size="small" variant="secondary" disabled={!media.length} onClick={clearDraftMedia}>
          Xoá hết
        </Button>
      </div>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="absolute h-0 w-0 opacity-0"
        onChange={handlePick}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="absolute h-0 w-0 opacity-0"
        onChange={handlePick}
      />

      <ul className="m-0 mt-3 list-none p-0">
        {media.map((item) => (
          <DraftMediaRow key={item.id} media={item} seconds={secondsFor(item.id)} />
        ))}
      </ul>
    </section>
  );
}

function DraftMediaRow({ media, seconds }: { media: DraftMedia; seconds: string | null }) {
  const previewUrl = media.status === DraftMediaStatus.ReadyToUpload ? media.previewUrl : null;
  const original =
    media.status === DraftMediaStatus.Optimizing || media.status === DraftMediaStatus.ReadyToUpload
      ? media.original
      : null;

  return (
    <li className="flex items-start gap-2 border-t border-slate-100 py-2 text-xs">
      <div className="h-12 w-12 flex-none overflow-hidden rounded bg-slate-100">
        {previewUrl && <img src={previewUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 break-all font-semibold">
          {media.kind === MediaKind.Video ? 'Video' : 'Ảnh'} · {media.file.name}
        </p>
        <p className="m-0 text-slate-500">
          Gốc {(media.file.size / MB).toFixed(2)} MB
          {original?.width && ` · ${original.width}×${original.height}`}
          {seconds && ` · ${seconds} s`}
        </p>
        <p className={media.status === DraftMediaStatus.Rejected ? 'm-0 text-red-600' : 'm-0'}>
          {describeStatus(media)}
        </p>
      </div>
      <Button size="small" variant="tertiary" onClick={() => removeDraftMedia(media.id)}>
        Xoá
      </Button>
    </li>
  );
}
