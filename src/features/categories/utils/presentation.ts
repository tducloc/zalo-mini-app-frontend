import { categoryPresentation, DEFAULT_CATEGORY_ICON } from '../constants';
import type { CategoryOption, CategoryResponse } from '../types';

const presentationById = new Map(categoryPresentation.map((item) => [item.id, item]));

export function getCategoryLabel(category: Pick<CategoryResponse, 'id' | 'name'>) {
  return presentationById.get(category.id)?.label ?? category.name;
}

/**
 * Known categories follow the fixed presentation order (the API sorts by English
 * name); categories the app does not know yet are appended in API order.
 */
export function presentCategories(categories: CategoryResponse[]): CategoryOption[] {
  const known = categoryPresentation.filter((item) =>
    categories.some((category) => category.id === item.id),
  );
  const unknown = categories
    .filter((category) => !presentationById.has(category.id))
    .map((category) => ({ id: category.id, label: category.name, icon: DEFAULT_CATEGORY_ICON }));

  return [...known, ...unknown];
}
