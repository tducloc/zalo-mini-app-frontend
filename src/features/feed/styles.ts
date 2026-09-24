// Tailwind class groups shared by the feed components.

// Home page: safe-area-aware fixed header; the content starts below it.
export const homePageVarsClass =
  '[--home-safe-top:max(24px,var(--zaui-safe-area-inset-top,env(safe-area-inset-top,0px)))] [--home-header-height:calc(var(--home-safe-top)_+_108px)]';
export const homeContentClass = 'px-4 pb-4 pt-[calc(var(--home-header-height)_+_20px)]';
export const sectionHeadingClass = 'mb-3 text-lg font-bold leading-6';

/** White surface with the brand hairline border (cards, inputs, pills). */
export const surfaceClass = 'border border-solid border-marketplace-line bg-white';

export const hiddenScrollbarClass = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

// Listing card and its skeleton share geometry so loading never shifts layout.
export const listingGridClass = 'grid grid-cols-2 gap-2.5';
export const listingCardClass = `block w-full overflow-hidden rounded-[10px] p-0 text-left text-inherit ${surfaceClass}`;
export const listingImageClass = 'relative h-[138px] bg-marketplace-skeleton';
// padding + 34px title + 25px price + 15px meta
export const listingCopyClass = 'h-[91px] px-[9px] pb-[9px] pt-2';
export const videoBadgeClass =
  'absolute bottom-2 left-2 inline-flex items-center gap-[3px] rounded-[10px] bg-marketplace-ink/70 py-0.5 pl-1.5 pr-2 text-micro font-semibold leading-4 text-white';
export const loadMoreButtonClass = `block min-h-11 w-full rounded-[10px] font-semibold text-marketplace-blue ${surfaceClass}`;

// Filter sheet
export const filterSectionSpacingClass = 'mt-[18px]';
export const filterSectionClass = `m-0 ${filterSectionSpacingClass} min-w-0 border-0 p-0`;
export const filterLabelClass = 'mb-2 block p-0 text-sm font-semibold text-marketplace-ink';
export const filterControlClass = `min-h-11 w-full rounded-[10px] px-3 text-[15px] text-marketplace-ink ${surfaceClass}`;
export const choicePillClass = `min-h-9 rounded-[18px] px-3.5 text-sm text-marketplace-ink ${surfaceClass} aria-pressed:border-marketplace-blue aria-pressed:bg-marketplace-tint aria-pressed:font-semibold aria-pressed:text-marketplace-blue`;

// Header and chips
export const filterBadgeClass =
  'absolute right-0.5 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-[5px] text-micro font-bold leading-[18px] text-marketplace-blue';
export const chipClass =
  'inline-flex min-h-8 flex-none items-center gap-1 rounded-2xl border border-solid text-caption font-semibold';
