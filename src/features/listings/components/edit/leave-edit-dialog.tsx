import { useRef } from 'react';
import { Modal } from 'zmp-ui';

import { leaveEditMessages } from '@/features/listings/constants/messages';

/**
 * Asks before leaving an edit with unsaved changes. Leaves once the dialog has closed:
 * zmp-ui unlocks the page's scrolling only then.
 */
export default function LeaveEditDialog({
  isVisible,
  onClose,
  onLeave,
}: {
  isVisible: boolean;
  onClose: () => void;
  onLeave: () => void;
}) {
  const isConfirmedRef = useRef(false);

  const handleConfirm = () => {
    isConfirmedRef.current = true;
    onClose();
  };

  const handleAfterClose = () => {
    if (isConfirmedRef.current) {
      isConfirmedRef.current = false;
      onLeave();
    }
  };

  return (
    <Modal
      visible={isVisible}
      title={leaveEditMessages.title}
      description={leaveEditMessages.description}
      onClose={onClose}
      afterClose={handleAfterClose}
      actions={[
        { text: leaveEditMessages.stay, onClick: onClose },
        { text: leaveEditMessages.leave, danger: true, onClick: handleConfirm },
      ]}
    />
  );
}
