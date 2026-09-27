import { useSession } from '@/features/auth/hooks/use-session';
import { statusChangeSuccess } from '@/features/my-listings/constants/messages';
import type { StatusChange } from '@/features/my-listings/types/my-listing';
import { getStatusChangeErrorMessage } from '@/features/my-listings/utils/my-listing';
import { useChangeListingStatus } from '@/features/products/api/listing-status';
import { useToast } from '@/hooks/use-toast';

/** Marks sold, hides or shows again a listing of the signed-in owner, saying how it went. */
export function useListingStatusAction() {
  const { session } = useSession();
  const { showError, showSuccess } = useToast();
  const mutation = useChangeListingStatus(session?.user.id ?? null);

  const changeStatus = (productId: string, change: StatusChange) =>
    mutation.mutate(
      { productId, change },
      {
        onSuccess: () => showSuccess(statusChangeSuccess[change]),
        onError: (error) => showError(getStatusChangeErrorMessage(error)),
      },
    );

  return { changeStatus, isPending: mutation.isPending };
}
