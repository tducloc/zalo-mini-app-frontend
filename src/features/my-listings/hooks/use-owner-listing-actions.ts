import { useState } from 'react';
import { useNavigate } from 'zmp-ui';

import { ConfirmTone } from '@/components/feedback/confirm-dialog';
import { useSession } from '@/features/auth/hooks/use-session';
import { useChangeListingStatus } from '@/features/my-listings/api/listing-status';
import { markSoldMessages, statusChangeSuccess } from '@/features/my-listings/constants/messages';
import { ListingAction, type StatusChange } from '@/features/my-listings/types/my-listing';
import { getStatusChangeErrorMessage } from '@/features/my-listings/utils/my-listing';
import { useToast } from '@/hooks/use-toast';

/**
 * What an owner's action in a "•••" sheet does: edit opens the edit page, "Đánh dấu đã bán"
 * asks first (sold is final), the others change the status at once, saying how it went.
 * Render `<ConfirmDialog {...markSoldDialog} />` after the sheet.
 */
export function useOwnerListingActions() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { showError, showSuccess } = useToast();
  const mutation = useChangeListingStatus(session?.user.id ?? null);

  // The id outlives `isOpen`: the dialog confirms only after it has closed.
  const [soldCandidate, setSoldCandidate] = useState<{ productId: string; isOpen: boolean }>();

  const changeStatus = (productId: string, change: StatusChange) =>
    mutation.mutate(
      { productId, change },
      {
        onSuccess: () => showSuccess(statusChangeSuccess[change]),
        onError: (error) => showError(getStatusChangeErrorMessage(error)),
      },
    );

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

  return { selectAction, markSoldDialog, isPending: mutation.isPending };
}
