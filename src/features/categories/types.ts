export type CategoryColor = 'blue' | 'coral' | 'green' | 'orange' | 'purple';

export interface Category {
  id: string;
  label: string;
  icon: 'zi-gallery' | 'zi-home' | 'zi-user-circle' | 'zi-auto' | 'zi-more-grid';
  color: CategoryColor;
}
