import { Icon } from 'zmp-ui';

import { sheetActionClass, sheetActionIconClass } from '@/components/layout/styles';
import { actionLabels } from '@/features/my-listings/constants/messages';
import { ListingAction } from '@/features/my-listings/types/my-listing';
import { getListingActions } from '@/features/my-listings/utils/my-listing';
import type { ProductStatus } from '@/features/products/types/product';

type ActionIcon = 'zi-edit' | 'zi-check-circle' | 'zi-hide' | 'zi-unhide';

const actionIcons: Record<ListingAction, ActionIcon> = {
  [ListingAction.Edit]: 'zi-edit',
  [ListingAction.MarkSold]: 'zi-check-circle',
  [ListingAction.Archive]: 'zi-hide',
  [ListingAction.Unarchive]: 'zi-unhide',
};

/** An owner's rows of a "Tuỳ chọn" sheet, for the listing's status. */
export default function OwnerActionList({
  status,
  isDisabled = false,
  onSelect,
}: {
  status: ProductStatus;
  isDisabled?: boolean;
  onSelect: (action: ListingAction) => void;
}) {
  return (
    <>
      {getListingActions(status).map((action) => (
        <button
          key={action}
          className={`${sheetActionClass} text-marketplace-ink disabled:opacity-45`}
          disabled={isDisabled}
          type="button"
          onClick={() => onSelect(action)}
        >
          <span
            aria-hidden="true"
            className={`${sheetActionIconClass} bg-marketplace-tint text-marketplace-blue`}
          >
            <Icon icon={actionIcons[action]} size={18} />
          </span>
          {actionLabels[action]}
        </button>
      ))}
    </>
  );
}
