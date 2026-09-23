export type CategoryIcon = 'zi-gallery' | 'zi-home' | 'zi-user-circle' | 'zi-auto' | 'zi-more-grid';

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
  icon: CategoryIcon;
}
