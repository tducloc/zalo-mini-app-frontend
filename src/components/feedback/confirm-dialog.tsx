import { useRef } from 'react';
import { Modal } from 'zmp-ui';

export interface ConfirmMessages {
  title: string;
  description: string;
  cancel: string;
  confirm: string;
}

export enum ConfirmTone {
  /** Something is lost: the confirm button is red. */
  Danger = 'danger',
  /** A final but wanted step: the confirm button is the brand colour. */
  Highlight = 'highlight',
}

/**
 * Asks before a step that cannot be undone. `onConfirm` runs once the dialog has closed:
 * zmp-ui unlocks the page's scrolling only then, and what opened the dialog may go away
 * with the step (a card leaving its list, the page itself).
 */
export default function ConfirmDialog({
  isVisible,
  messages,
  tone,
  onClose,
  onConfirm,
}: {
  isVisible: boolean;
  messages: ConfirmMessages;
  tone: ConfirmTone;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isConfirmedRef = useRef(false);

  const handleConfirm = () => {
    isConfirmedRef.current = true;
    onClose();
  };

  const handleAfterClose = () => {
    if (isConfirmedRef.current) {
      isConfirmedRef.current = false;
      onConfirm();
    }
  };

  return (
    <Modal
      visible={isVisible}
      title={messages.title}
      description={messages.description}
      onClose={onClose}
      afterClose={handleAfterClose}
      actions={[
        { text: messages.cancel, onClick: onClose },
        {
          text: messages.confirm,
          danger: tone === ConfirmTone.Danger,
          highLight: tone === ConfirmTone.Highlight,
          onClick: handleConfirm,
        },
      ]}
    />
  );
}
