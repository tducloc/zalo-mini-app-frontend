import { useEffect, useRef, useState } from 'react';
import { Button } from 'zmp-ui';

import DraftMediaRow, { type RowTimes } from '@/features/lab/media/draft-media-row';
import { startFrameMeter } from '@/features/lab/media/frame-meter';
import { createStageBreadcrumb } from '@/features/lab/media/stage-breadcrumb';
import { addDraftFiles, discardDraft } from '@/features/listings/services/add-media';
import { refusedFilesMessage } from '@/features/listings/constants/messages';
import { DraftMediaStatus, type DraftMedia } from '@/features/listings/types/draft-media';
import { canOptimizeImages } from '@/features/media/services/image-worker';
import { takePickedFiles } from '@/features/media/utils/media';
import { canConvertVideos } from '@/features/media/services/convert-video';
import { useListingDraftStore } from '@/stores/listing-draft';

/**
 * The real create-listing pipeline (draft store, intake L4, uploads L5) on files picked
 * here, to check it on the phone: each file's state, sizes, time to ready and to upload,
 * and the longest main-thread frame while anything works. L4 gate: 10 × 24 MP photos
 * without a crash; L5 gate: turn the network off mid-upload and on again. Uploads go to
 * the API in VITE_API_BASE_URL, signed in as the current Zalo user. It shares the draft
 * with the sell page, as the form will.
 */

const breadcrumb = createStageBreadcrumb('medialab.draftStage');

interface Timing {
  pickedAt: number;
  readyAt?: number;
  uploadStartedAt?: number;
  uploadedAt?: number;
}

const secondsBetween = (from?: number, to?: number) =>
  from !== undefined && to !== undefined ? ((to - from) / 1000).toFixed(1) : null;

const isWorking = (media: DraftMedia) =>
  media.status === DraftMediaStatus.Checking || media.status === DraftMediaStatus.Optimizing;

function describeDevice() {
  return [
    `Tối ưu ảnh ${canOptimizeImages ? 'có' : 'KHÔNG (gửi ảnh gốc)'}`,
    `Chuyển video ${canConvertVideos ? 'có' : 'KHÔNG (gửi video gốc)'}`,
    `cores ${navigator.hardwareConcurrency ?? '?'}`,
  ].join(' · ');
}

export default function DraftMediaLab() {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const media = useListingDraftStore((state) => state.media);

  const timings = useRef(new Map<string, Timing>());
  const [longestFrameMs, setLongestFrameMs] = useState<number | null>(null);
  const [crashedStage] = useState(breadcrumb.read);
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);

  const isBusy = media.some(isWorking);

  useEffect(() => {
    const now = performance.now();
    for (const item of media) {
      const timing = timings.current.get(item.id) ?? { pickedAt: now };
      timings.current.set(item.id, timing);
      if (timing.readyAt === undefined && !isWorking(item)) {
        timing.readyAt = now;
      }
      if (timing.uploadStartedAt === undefined && item.status === DraftMediaStatus.Uploading) {
        timing.uploadStartedAt = now;
      }
      if (timing.uploadedAt === undefined && item.status === DraftMediaStatus.Uploaded) {
        timing.uploadedAt = now;
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

  // Left behind only if the app dies mid-run: the next open says so.
  const workingCount = media.filter(isWorking).length;
  useEffect(() => {
    if (workingCount > 0) {
      breadcrumb.write(`đang xử lý ${workingCount} tệp`);
    } else {
      breadcrumb.clear();
    }
  }, [workingCount]);

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const refused = await addDraftFiles(takePickedFiles(event.target));
    setRefusedMessage(refused.length > 0 ? refusedFilesMessage(refused) : null);
  };

  const timesFor = (id: string): RowTimes => {
    const timing = timings.current.get(id);
    return {
      preparing: secondsBetween(timing?.pickedAt, timing?.readyAt),
      uploading: secondsBetween(timing?.uploadStartedAt, timing?.uploadedAt),
    };
  };

  return (
    <section className="marketplace-card mt-3 p-4">
      <p className="field-heading m-0">Quy trình đăng tin thật (L4 + L5)</p>
      <p className="m-0 mt-1 text-sm text-slate-500">{describeDevice()}</p>
      {crashedStage && (
        <p className="m-0 mt-2 text-sm font-semibold text-red-600">
          Lần trước app bị tải lại khi: {crashedStage}
        </p>
      )}
      <p className="m-0 mt-1 text-sm text-slate-500">
        Frame dài nhất khi đang xử lý:{' '}
        {/* 0 means no frame was drawn at all: the page was hidden while it worked. */}
        {longestFrameMs ? `${Math.round(longestFrameMs)} ms` : '–'}
        {isBusy && ' (đang đo)'}
      </p>

      {refusedMessage && (
        <p className="m-0 mt-2 text-sm text-red-600" role="status">
          Không thêm: {refusedMessage}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="small" onClick={() => photoInputRef.current?.click()}>
          Thêm ảnh
        </Button>
        <Button size="small" onClick={() => videoInputRef.current?.click()}>
          Thêm video
        </Button>
        <Button size="small" variant="secondary" disabled={!media.length} onClick={discardDraft}>
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
          <DraftMediaRow key={item.id} media={item} times={timesFor(item.id)} />
        ))}
      </ul>
    </section>
  );
}
