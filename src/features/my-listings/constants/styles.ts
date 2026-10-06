// Tailwind class groups shared by the my-listings card and its skeleton, so loading never shifts layout.

export const myListingCardClass =
  'relative flex gap-3 rounded-xl border border-solid border-marketplace-line bg-white p-3';

export const myListingThumbnailClass = 'size-[88px] flex-none overflow-hidden rounded-lg';
/** Behind a loaded photo: black bars beside a contained, non-square photo. */
export const myListingPhotoBackdropClass = 'bg-black';
export const myListingEmptyBackdropClass = 'bg-marketplace-skeleton';

export const myListingStackClass = 'flex flex-col gap-2.5';
