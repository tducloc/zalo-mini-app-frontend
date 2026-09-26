import { useRef, useState } from 'react';
import { Modal } from 'zmp-ui';

import { discardMessages } from '@/features/listings/constants/messages';

/**
 * "Huỷ tin", asking first: the draft's files and fields cannot be brought back. The draft
 * ends once the dialog has closed: zmp-ui unlocks the page's scrolling only then, and this
 * button goes with the draft.
 */
export default function DiscardDraftButton({
  isDisabled,
  onDiscard,
}: {
  isDisabled: boolean;
  onDiscard: () => void;
}) {
  const [isAsking, setIsAsking] = useState(false);
  const isConfirmedRef = useRef(false);

  const handleClose = () => setIsAsking(false);

  const handleConfirm = () => {
    isConfirmedRef.current = true;
    setIsAsking(false);
  };

  const handleAfterClose = () => {
    if (isConfirmedRef.current) {
      isConfirmedRef.current = false;
      onDiscard();
    }
  };

  return (
    <>
      <button
        type="button"
        className="ui-button secondary mt-3"
        disabled={isDisabled}
        onClick={() => setIsAsking(true)}
      >
        Huỷ tin
      </button>
      <Modal
        visible={isAsking}
        title={discardMessages.title}
        description={discardMessages.description}
        onClose={handleClose}
        afterClose={handleAfterClose}
        actions={[
          { text: 'Tiếp tục đăng', onClick: handleClose },
          { text: 'Huỷ tin', danger: true, onClick: handleConfirm },
        ]}
      />
    </>
  );
}
