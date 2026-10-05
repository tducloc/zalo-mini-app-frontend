import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { openChat, openPhone, openProfile } from 'zmp-sdk';

import ProductContactAction from '@/features/products/components/detail/contact-action';
import type { ProductDetail } from '@/features/products/types/product';

vi.mock('zmp-sdk', () => ({ openChat: vi.fn(), openPhone: vi.fn(), openProfile: vi.fn() }));
vi.mock('zmp-ui', () => ({
  Icon: () => null,
  Button: ({
    variant: _variant,
    prefixIcon: _icon,
    fullWidth: _fullWidth,
    ...props
  }: ComponentProps<'button'> & {
    variant?: string;
    prefixIcon?: ReactNode;
    fullWidth?: boolean;
  }) => <button type="button" {...props} />,
}));

const product = (status: ProductDetail['status'], phoneNumber: string | null): ProductDetail =>
  ({
    id: 'prd_1',
    title: 'Sofa góc chữ L',
    status,
    seller: {
      id: 'seller_1',
      name: 'Linh',
      avatarUrl: null,
      contact: { zaloProfileId: 'zalo_seller', phoneNumber },
    },
  }) as ProductDetail;

function renderAction(status: ProductDetail['status'], phoneNumber: string | null) {
  const onContactError = vi.fn();
  render(
    <ProductContactAction product={product(status, phoneNumber)} onContactError={onContactError} />,
  );
  return onContactError;
}

afterEach(() => vi.resetAllMocks());

describe('ProductContactAction', () => {
  it('offers a call and a Zalo chat once the seller has shared a number', () => {
    renderAction('PUBLISHED', '0912345678');

    fireEvent.click(screen.getByRole('button', { name: 'Gọi điện' }));
    expect(openPhone).toHaveBeenCalledWith({ phoneNumber: '0912345678' });
    expect(screen.getByRole('button', { name: 'Nhắn qua Zalo' })).toBeTruthy();
  });

  it('keeps the call button, disabled, without a number', () => {
    renderAction('PUBLISHED', null);

    const call = screen.getByRole<HTMLButtonElement>('button', { name: 'Gọi điện' });
    expect(call.disabled).toBe(true);
    fireEvent.click(call);
    expect(openPhone).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Nhắn qua Zalo' }).disabled).toBe(
      false,
    );
  });

  it('opens the chat with a greeting about the listing', async () => {
    vi.mocked(openChat).mockResolvedValue(undefined as never);
    renderAction('PUBLISHED', null);

    fireEvent.click(screen.getByRole('button', { name: 'Nhắn qua Zalo' }));
    await waitFor(() =>
      expect(openChat).toHaveBeenCalledWith({
        type: 'user',
        id: 'zalo_seller',
        message:
          'Chào bạn, mình quan tâm tin "Sofa góc chữ L" trên Chợ Zalo. Sản phẩm còn không ạ?',
      }),
    );
    expect(openProfile).not.toHaveBeenCalled();
  });

  it("ends the greeting with the listing's Mini App link inside Zalo", async () => {
    vi.stubGlobal('APP_ID', '1234567890');
    vi.mocked(openChat).mockResolvedValue(undefined as never);
    renderAction('PUBLISHED', null);

    fireEvent.click(screen.getByRole('button', { name: 'Nhắn qua Zalo' }));
    await waitFor(() =>
      expect(vi.mocked(openChat).mock.calls[0]?.[0].message).toMatch(
        /Sản phẩm còn không ạ\?\nhttps:\/\/zalo\.me\/s\/1234567890\/products\/prd_1$/,
      ),
    );
    vi.unstubAllGlobals();
  });

  it("opens the seller's profile when the chat does not open, then says it failed", async () => {
    vi.mocked(openChat).mockRejectedValue(new Error('not allowed'));
    vi.mocked(openProfile).mockRejectedValue(new Error('not allowed'));
    const onContactError = renderAction('PUBLISHED', null);

    fireEvent.click(screen.getByRole('button', { name: 'Nhắn qua Zalo' }));
    await waitFor(() =>
      expect(onContactError).toHaveBeenCalledWith('Không thể mở Zalo trên thiết bị này.'),
    );
    expect(openProfile).toHaveBeenCalledWith({ type: 'user', id: 'zalo_seller' });
  });

  it('stays on screen when the seller has no contact', () => {
    const bare = product('PUBLISHED', null);
    bare.seller.contact = null;
    render(<ProductContactAction product={bare} onContactError={vi.fn()} />);

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Gọi điện' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Nhắn qua Zalo' }).disabled).toBe(
      true,
    );
  });

  it('offers nothing on a sold listing', () => {
    renderAction('SOLD', '0912345678');

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Sản phẩm đã bán' }).disabled,
    ).toBe(true);
  });
});
