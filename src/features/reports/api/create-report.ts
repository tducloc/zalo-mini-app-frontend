import { http } from '@/lib/http';

export type ReportReason = 'SCAM' | 'MISLEADING' | 'PROHIBITED_ITEM' | 'SPAM' | 'OTHER';

export async function reportProduct(
  productId: string,
  input: { reason: ReportReason; description?: string },
) {
  await http.post(`/products/${encodeURIComponent(productId)}/reports`, input);
}
