import { type ReactNode, useEffect, useState } from 'react';
import { Button } from 'zmp-ui';
import { openPhone, openProfile } from 'zmp-sdk';

import { ProductDetail } from '@/features/products/types/product';

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
  const [showPhoneFallback, setShowPhoneFallback] = useState(false);

  useEffect(() => setShowPhoneFallback(false), [product.id, contact?.phoneNumber]);

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

  return (
    <footer className="product-detail-actions">
      {banner}
      <Button fullWidth disabled={!canContact || product.status === 'SOLD'} onClick={contactSeller}>
        {product.status === 'SOLD'
          ? 'Sản phẩm đã bán'
          : canContact
            ? 'Liên hệ người bán'
            : 'Người bán chưa bật liên hệ'}
      </Button>
      {showPhoneFallback && (
        <button className="product-contact-fallback" onClick={callSeller}>
          Gọi số điện thoại người bán
        </button>
      )}
    </footer>
  );
}
