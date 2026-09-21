import { http } from '@/lib/http';

import { ProductDetail } from '../types';

export async function getProductDetail(productId: string) {
  const response = await http.get<{ data: ProductDetail }>(
    `/products/${encodeURIComponent(productId)}`,
  );
  return response.data.data;
}
