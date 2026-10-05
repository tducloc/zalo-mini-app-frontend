import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { ListingAction } from '@/features/my-listings/types/my-listing';
import { getListingActions } from '@/features/my-listings/utils/my-listing';
import ProductOwnerBar from '@/features/products/components/detail/owner-bar';
import type { ProductStatus } from '@/features/products/types/product';

vi.mock('zmp-ui', () => ({
  Button: ({ variant: _variant, ...props }: ComponentProps<'button'> & { variant?: string }) => (
    <button type="button" {...props} />
  ),
}));

const statuses: ProductStatus[] = ['PUBLISHED', 'PROCESSING', 'FAILED', 'ARCHIVED', 'SOLD'];

function renderBar(status: ProductStatus, isPending = false) {
  const onAction = vi.fn();
  render(<ProductOwnerBar status={status} isPending={isPending} onAction={onAction} />);
  return onAction;
}

describe('ProductOwnerBar', () => {
  it('offers only what the "•••" sheet allows for the status', () => {
    for (const status of statuses) {
      const onAction = vi.fn();
      const { unmount } = render(
        <ProductOwnerBar status={status} isPending={false} onAction={onAction} />,
      );
      screen.queryAllByRole('button').forEach((button) => fireEvent.click(button));
      for (const [action] of onAction.mock.calls) {
        expect(getListingActions(status)).toContain(action);
      }
      unmount();
    }
  });

  it('tells a published listing is shown, and marks it sold or opens the edit', () => {
    const onAction = renderBar('PUBLISHED');

    expect(screen.getByRole('status').textContent).toBe('Tin của bạn đang hiển thị với người mua.');
    expect(screen.queryByText('Liên hệ người bán')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Đã bán' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sửa tin' }));
    expect(onAction.mock.calls).toEqual([[ListingAction.MarkSold], [ListingAction.Edit]]);
  });

  it('shows a hidden listing again from the bar', () => {
    const onAction = renderBar('ARCHIVED');

    expect(screen.getByRole('status').textContent).toContain('Người mua không thấy tin này');
    fireEvent.click(screen.getByRole('button', { name: 'Hiện lại' }));
    expect(onAction).toHaveBeenCalledWith(ListingAction.Unarchive);
  });

  it('only tells a sold listing is sold', () => {
    renderBar('SOLD');

    expect(screen.getByRole('status').textContent).toContain('Bạn đã bán sản phẩm này');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('waits while a status change is on its way', () => {
    const onAction = renderBar('PUBLISHED', true);

    fireEvent.click(screen.getByRole('button', { name: 'Đã bán' }));
    expect(onAction).not.toHaveBeenCalled();
  });
});
