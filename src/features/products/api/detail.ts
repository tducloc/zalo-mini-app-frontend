import { http } from '@/lib/http';

import { ProductDetail } from '../types';

export async function getProductDetail(productId: string) {
  const { data } = await http.get<ProductDetail>(`/products/${encodeURIComponent(productId)}`);
  return data;
}
