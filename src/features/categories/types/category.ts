import type { LucideIcon } from 'lucide-react';

/** Category as returned by `GET /categories`. */
export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
}

/** Category ready for display: Vietnamese label and icon. */
export interface CategoryOption {
  id: string;
  label: string;
  // zmp-ui has no product or vehicle glyphs, so categories use Lucide icons.
  icon: LucideIcon;
}
