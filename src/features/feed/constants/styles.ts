// Tailwind class groups shared by the feed components.

/** White surface with the brand hairline border (cards, inputs, pills). */
export const surfaceClass = 'border border-solid border-marketplace-line bg-white';

// Listing card and its skeleton share geometry so loading never shifts layout.
export const listingGridClass = 'grid grid-cols-2 gap-2.5';
export const listingCardClass = `block w-full overflow-hidden rounded-[10px] p-0 text-left text-inherit ${surfaceClass}`;
export const listingImageClass = 'relative aspect-square bg-marketplace-skeleton';
// padding + 34px title + 25px price + 15px meta
export const listingCopyClass = 'h-[91px] px-[9px] pb-[9px] pt-2';

// Filter sheet
export const filterSectionSpacingClass = 'mt-[18px]';
export const filterSectionClass = `m-0 ${filterSectionSpacingClass} min-w-0 border-0 p-0`;
export const filterLabelClass = 'mb-2 block p-0 text-sm font-semibold text-marketplace-ink';
export const filterControlClass = `min-h-11 w-full rounded-[10px] px-3 text-[15px] text-marketplace-ink ${surfaceClass}`;
