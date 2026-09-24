// @vitest-environment jsdom
import { productDetailQueryOptions } from '@/features/products/api/get-product-detail';
import { productKeys } from '@/features/products/api/keys';
import type { ProductDetail } from '@/features/products/types';

const product = (id: string) => ({ id, title: id }) as unknown as ProductDetail;

describe('productDetailQueryOptions', () => {
  const { placeholderData, queryKey } = productDetailQueryOptions('prd_1', 'user_1');
  const placeholder = (previous: ProductDetail | undefined) =>
    typeof placeholderData === 'function' ? placeholderData(previous, undefined) : placeholderData;

  it('keys the detail by product and viewer', () => {
    expect(queryKey).toEqual(productKeys.detail('prd_1', 'user_1'));
  });

  it('keeps showing the anonymous copy of the same product while the viewer copy loads', () => {
    expect(placeholder(product('prd_1'))).toEqual(product('prd_1'));
  });

  it("never shows another product's data as a placeholder", () => {
    expect(placeholder(product('prd_2'))).toBeUndefined();
    expect(placeholder(undefined)).toBeUndefined();
  });
});
