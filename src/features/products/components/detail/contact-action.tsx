import { type ReactNode, useState } from 'react';
import { Button } from 'zmp-ui';
import { openPhone, openProfile } from 'zmp-sdk';

import { ProductDetail } from '@/features/products/types/product';

/** Keyed by the product at the call site, so another product starts without the fallback. */
export default function ProductContactAction({
  product,
  banner,
  onContactError,
}: {
  product: ProductDetail;
  /** Above the button, in the same bar, so the two never overlap. */
  banner: ReactNode;
  onContactError: (message: string) => void;
}) {
  const contact = product.seller.contact;
  const canContact = Boolean(contact);
  const isSold = product.status === 'SOLD';
  const [showPhoneFallback, setShowPhoneFallback] = useState(false);

  const contactSeller = async () => {
    if (!contact) return;
    try {
      await openProfile({ id: contact.zaloProfileId, type: 'user' });
    } catch {
      if (contact.phoneNumber) {
        setShowPhoneFallback(true);
        return;
      }
      onContactError('Không thể mở liên hệ trên thiết bị này.');
    }
  };

  const callSeller = async () => {
    if (!contact?.phoneNumber) return;
    try {
      await openPhone({ phoneNumber: contact.phoneNumber });
    } catch {
      onContactError('Không thể mở cuộc gọi trên thiết bị này.');
    }
  };

  const openLabel = canContact ? 'Liên hệ người bán' : 'Người bán chưa bật liên hệ';
  const contactLabel = isSold ? 'Sản phẩm đã bán' : openLabel;
  // A refetch can drop the number while the fallback is up.
  const isPhoneFallbackShown = showPhoneFallback && Boolean(contact?.phoneNumber);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-solid border-marketplace-line bg-white px-4 pb-[calc(12px_+_var(--zaui-safe-area-inset-bottom))] pt-3">
      {banner}
      <Button className="h-11" fullWidth disabled={!canContact || isSold} onClick={contactSeller}>
        {contactLabel}
      </Button>
      {isPhoneFallbackShown && (
        <button
          className="mt-2 block w-full border-0 p-1.5 text-caption font-semibold text-marketplace-blue"
          onClick={callSeller}
        >
          Gọi số điện thoại người bán
        </button>
      )}
    </footer>
  );
}
