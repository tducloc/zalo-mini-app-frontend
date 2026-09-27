import { useState } from 'react';
import { useNavigate } from 'zmp-ui';

import { ConfirmTone } from '@/components/feedback/confirm-dialog';
import { markSoldMessages } from '@/features/my-listings/constants/messages';
import { useListingStatusAction } from '@/features/my-listings/hooks/use-listing-status-action';
import { ListingAction } from '@/features/my-listings/types/my-listing';

/**
 * What an owner's action in a "•••" sheet does: edit opens the edit page, "Đánh dấu đã bán"
 * asks first (sold is final), the others change the status at once. Render
 * `<ConfirmDialog {...markSoldDialog} />` after the sheet.
 */
export function useOwnerListingActions() {
  const navigate = useNavigate();
  const { changeStatus, isPending } = useListingStatusAction();

  // The id outlives `isOpen`: the dialog confirms only after it has closed.
  const [soldCandidate, setSoldCandidate] = useState<{ productId: string; isOpen: boolean }>();

  const selectAction = (productId: string, action: ListingAction) => {
    if (action === ListingAction.Edit) {
      navigate(`/products/${encodeURIComponent(productId)}/edit`);
      return;
    }

    if (action === ListingAction.MarkSold) {
      setSoldCandidate({ productId, isOpen: true });
      return;
    }

    changeStatus(productId, action);
  };

  const handleCloseDialog = () =>
    setSoldCandidate((current) => current && { ...current, isOpen: false });

  const handleConfirmSold = () => {
    if (soldCandidate) {
      changeStatus(soldCandidate.productId, ListingAction.MarkSold);
    }
  };

  const markSoldDialog = {
    isVisible: Boolean(soldCandidate?.isOpen),
    messages: markSoldMessages,
    tone: ConfirmTone.Highlight,
    onClose: handleCloseDialog,
    onConfirm: handleConfirmSold,
  };

  return { selectAction, markSoldDialog, isPending };
}
