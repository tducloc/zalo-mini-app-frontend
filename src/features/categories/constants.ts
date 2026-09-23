import { CategoryOption } from './types';

// Display order and Vietnamese labels; IDs must match the backend seed.
export const categoryPresentation: CategoryOption[] = [
  { id: 'cat_electronics', label: 'Điện tử', icon: 'zi-gallery' },
  { id: 'cat_home_living', label: 'Nhà cửa', icon: 'zi-home' },
  { id: 'cat_fashion', label: 'Thời trang', icon: 'zi-user-circle' },
  { id: 'cat_vehicles', label: 'Xe cộ', icon: 'zi-auto' },
  { id: 'cat_others', label: 'Khác', icon: 'zi-more-grid' },
];

export const DEFAULT_CATEGORY_ICON: CategoryOption['icon'] = 'zi-more-grid';
