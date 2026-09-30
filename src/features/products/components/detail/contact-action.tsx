import { Button, Icon } from 'zmp-ui';
import { openChat, openPhone, openProfile } from 'zmp-sdk';

import { ProductDetail } from '@/features/products/types/product';

/** The first message in the chat, which the buyer can edit before sending. */
export const chatGreeting = (title: string) =>
  `Chào bạn, mình quan tâm tin "${title}" trên Chợ Zalo. Sản phẩm còn không ạ?`;

/**
 * A buyer's two ways to the seller: a Zalo chat about this listing, and a call, possible
 * once the seller has shared their number. A sold listing offers neither.
 */
export default function ProductContactAction({
  product,
  onContactError,
}: {
  product: ProductDetail;
  onContactError: (message: string) => void;
}) {
  const zaloProfileId = product.seller.contact?.zaloProfileId;
  const phoneNumber = product.seller.contact?.phoneNumber ?? null;

  if (product.status === 'SOLD') {
    return (
      <Button className="h-11" fullWidth disabled>
        Sản phẩm đã bán
      </Button>
    );
  }

  const messageSeller = async () => {
    if (!zaloProfileId) return;
    try {
      await openChat({ type: 'user', id: zaloProfileId, message: chatGreeting(product.title) });
    } catch {
      // The profile has its own "Nhắn tin", where the chat may not open directly.
      try {
        await openProfile({ type: 'user', id: zaloProfileId });
      } catch {
        onContactError('Không thể mở Zalo trên thiết bị này.');
      }
    }
  };

  const callSeller = async () => {
    if (!phoneNumber) return;
    try {
      await openPhone({ phoneNumber });
    } catch {
      onContactError('Không thể mở cuộc gọi trên thiết bị này.');
    }
  };

  return (
    <div className="flex gap-2">
      {/* Shown, disabled, without a number: the buyer sees that calling is not possible. */}
      <Button
        className="h-11 flex-1"
        variant="secondary"
        disabled={!phoneNumber}
        prefixIcon={<Icon icon="zi-call" />}
        onClick={callSeller}
      >
        Gọi điện
      </Button>
      <Button
        className="h-11 flex-1"
        disabled={!zaloProfileId}
        prefixIcon={<Icon icon="zi-chat" />}
        onClick={messageSeller}
      >
        Nhắn qua Zalo
      </Button>
    </div>
  );
}
