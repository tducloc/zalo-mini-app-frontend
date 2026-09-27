// Tailwind class groups shared by the pages.

/**
 * A page above the tab bar (74px, and 8px), with room at its end for the draft banner
 * while it shows (52px and a 10px gap).
 */
export const pageClass = 'bg-white pb-[82px] [.has-draft-banner_&]:pb-[144px]';

/** The content under a MobilePageHeader (44px and the safe area, then 16px). */
export const pageContentClass = 'px-4 pb-4 pt-[calc(60px_+_var(--zaui-safe-area-inset-top))]';

export const cardClass =
  'rounded-2xl border border-solid border-marketplace-line bg-white shadow-[0_2px_8px_rgb(23_57_108/4%)]';

export const stateIconClass =
  'mx-auto mb-3 mt-0 grid size-[54px] place-items-center rounded-full bg-marketplace-pale text-marketplace-blue';
