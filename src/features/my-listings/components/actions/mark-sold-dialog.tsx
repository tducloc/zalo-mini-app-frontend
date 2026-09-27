import { useRef } from 'react';
import { Modal } from 'zmp-ui';

import { markSoldMessages } from '@/features/my-listings/constants/messages';

/**
 * Asks before marking a listing sold, which cannot be undone. The change starts once the
 * dialog has closed: zmp-ui unlocks the page's scrolling only then, and the card that opened
 * it may leave the list.
 */
export default function MarkSoldDialog({
  visible,
  onClose,
  onConfirmed,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const isConfirmedRef = useRef(false);

  const handleConfirm = () => {
    isConfirmedRef.current = true;
    onClose();
  };

  const handleAfterClose = () => {
    if (isConfirmedRef.current) {
      isConfirmedRef.current = false;
      onConfirmed();
    }
  };

  return (
    <Modal
      visible={visible}
      title={markSoldMessages.title}
      description={markSoldMessages.description}
      onClose={onClose}
      afterClose={handleAfterClose}
      actions={[
        { text: markSoldMessages.cancel, onClick: onClose },
        { text: markSoldMessages.confirm, highLight: true, onClick: handleConfirm },
      ]}
    />
  );
}
