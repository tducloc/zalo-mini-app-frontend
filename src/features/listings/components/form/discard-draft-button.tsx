import { useState } from 'react';

import ActionButton from '@/components/action-button';
import ConfirmDialog, { ConfirmTone } from '@/components/feedback/confirm-dialog';
import { discardMessages } from '@/features/listings/constants/messages';

/** "Huỷ tin", asking first: the draft's files and fields cannot be brought back. */
export default function DiscardDraftButton({
  isDisabled,
  onDiscard,
}: {
  isDisabled: boolean;
  onDiscard: () => void;
}) {
  const [isAsking, setIsAsking] = useState(false);

  return (
    <>
      <ActionButton
        type="button"
        variant="secondary"
        className="mt-3"
        disabled={isDisabled}
        onClick={() => setIsAsking(true)}
      >
        {discardMessages.confirm}
      </ActionButton>
      <ConfirmDialog
        isVisible={isAsking}
        messages={discardMessages}
        tone={ConfirmTone.Danger}
        onClose={() => setIsAsking(false)}
        onConfirm={onDiscard}
      />
    </>
  );
}
