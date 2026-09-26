import { LayoutGrid, Motorbike, Shirt, Smartphone, Sofa } from 'lucide-react';

import { CategoryOption } from '@/features/categories/types/category';

// Display order and Vietnamese labels; IDs must match the backend seed.
export const categoryPresentation: CategoryOption[] = [
  { id: 'cat_electronics', label: 'Điện tử', icon: Smartphone },
  { id: 'cat_home_living', label: 'Nhà cửa', icon: Sofa },
  { id: 'cat_fashion', label: 'Thời trang', icon: Shirt },
  { id: 'cat_vehicles', label: 'Xe cộ', icon: Motorbike },
  { id: 'cat_others', label: 'Khác', icon: LayoutGrid },
];

export const DEFAULT_CATEGORY_ICON: CategoryOption['icon'] = LayoutGrid;
