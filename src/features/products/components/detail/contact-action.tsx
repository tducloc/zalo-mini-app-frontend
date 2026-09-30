import { useState } from 'react';
import { Button } from 'zmp-ui';
import { openPhone, openProfile } from 'zmp-sdk';

import { ProductDetail } from '@/features/products/types/product';

/** Keyed by the product at the call site, so another product starts without the fallback. */
export default function ProductContactAction({
  product,
  onContactError,
}: {
  product: ProductDetail;
  onContactError: (message: string) => void;
}) {
  const contact = product.seller.contact;
  const isSold = product.status === 'SOLD';
  const [showPhoneFallback, setShowPhoneFallback] = useState(false);

  const contactSeller = async () => {
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
    if (!contact.phoneNumber) return;
    try {
      await openPhone({ phoneNumber: contact.phoneNumber });
    } catch {
      onContactError('Không thể mở cuộc gọi trên thiết bị này.');
    }
  };

  const contactLabel = isSold ? 'Sản phẩm đã bán' : 'Liên hệ người bán';
  // A refetch can drop the number while the fallback is up.
  const isPhoneFallbackShown = showPhoneFallback && Boolean(contact.phoneNumber);

  return (
    <>
      <Button className="h-11" fullWidth disabled={isSold} onClick={contactSeller}>
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
    </>
  );
}
