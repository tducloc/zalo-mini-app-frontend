import { type ChangeEvent, useRef } from 'react';

import { type RefusedFile, replaceDraftMedia } from '@/features/listings/draft/media-intake';
import type { DraftMedia } from '@/features/listings/draft/media-reducer';
import { MediaKind } from '@/features/media/media-utils';

/**
 * Puts another file in a draft file's place: `startReplace` opens the picker for its kind,
 * `replaceInputs` are those pickers, hidden, to render once.
 */
export function useReplaceMedia({
  photoTypes,
  videoTypes,
  onReplaced,
  onRefused,
}: {
  photoTypes: string;
  videoTypes: string;
  onReplaced: () => void;
  onRefused: (refused: RefusedFile[]) => void;
}) {
  const replacedId = useRef<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const startReplace = (item: DraftMedia) => {
    replacedId.current = item.id;
    (item.kind === MediaKind.Video ? videoInput : photoInput).current?.click();
  };

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Picking the same file again must fire change again.
    event.target.value = '';
    const id = replacedId.current;
    if (!file || !id) {
      return;
    }

    onReplaced();
    const refused = await replaceDraftMedia(id, file);
    if (refused.length > 0) {
      onRefused(refused);
    }
  };

  const replaceInputs = (
    <>
      <input ref={photoInput} type="file" accept={photoTypes} hidden onChange={handlePick} />
      <input ref={videoInput} type="file" accept={videoTypes} hidden onChange={handlePick} />
    </>
  );

  return { startReplace, replaceInputs };
}
