import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'zmp-ui';
import { useStore } from 'zustand';

import ActionButton from '@/components/action-button';
import MobilePageHeader from '@/components/layout/mobile-page-header';
import { pageContentClass } from '@/components/layout/styles';
import LeaveEditDialog from '@/features/listings/components/edit/leave-edit-dialog';
import ListingFields from '@/features/listings/components/form/listing-fields';
import MediaSection from '@/features/listings/components/media/media-section';
import { saveMessages } from '@/features/listings/constants/messages';
import { formNoteClass } from '@/features/listings/constants/styles';
import { useListingForm } from '@/features/listings/hooks/use-listing-form';
import { useSaveListing } from '@/features/listings/hooks/use-save-listing';
import { createEditPipeline } from '@/features/listings/services/media-pipeline';
import {
  draftFromProduct,
  editBaseline,
  isMediaChanged,
} from '@/features/listings/utils/edit-listing';
import type { ProductDetail } from '@/features/products/types/product';

/**
 * The edit page's header and form: the sell form's fields and media section, on a draft of
 * the page's own that starts with the listing (plans/create-listing.md: editing "keeps its
 * state on the page"), so a draft on the sell page is left alone. Closing the page stops
 * its uploads and deletes the new ones, unless they were saved; the listing's own media
 * is only removed by a save.
 */
export default function EditListingForm({
  product,
  viewerId,
}: {
  product: ProductDetail;
  viewerId: string | null;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Started once from the listing; a later refetch of it does not reset the form.
  const [start] = useState(() => draftFromProduct(product));
  const [baseline] = useState(() => editBaseline(product));
  const [pipeline] = useState(() => createEditPipeline(start));
  const [isLeaveAsked, setIsLeaveAsked] = useState(false);

  useEffect(() => pipeline.start(), [pipeline]);

  const media = useStore(pipeline.store, (state) => state.media);
  const {
    form,
    mediaRef,
    isPosting,
    isWorking,
    isSubmitDisabled,
    isPhotoMissing,
    scrollToMedia,
    markRefusedFields,
    submitWith,
  } = useListingForm(pipeline.store, start.fields);

  // Opened from a link, there is nothing to go back to: the listing's page, then.
  const leave = () => {
    if (location.key === 'default') {
      navigate(`/products/${encodeURIComponent(product.id)}`, { replace: true });
      return;
    }
    navigate(-1);
  };

  const saveListing = useSaveListing({
    productId: product.id,
    viewerId,
    pipeline,
    baseline,
    onFieldErrors: markRefusedFields,
    onMediaErrors: scrollToMedia,
    onDone: leave,
  });
  const handleSave = submitWith(saveListing);

  const hasChanges = form.formState.isDirty || isMediaChanged(baseline, media);
  const handleBack = () => {
    if (hasChanges) {
      setIsLeaveAsked(true);
      return;
    }
    leave();
  };

  return (
    <>
      <MobilePageHeader title="Sửa tin" showBack onBack={handleBack} />
      <main className={pageContentClass}>
        <form
          // A focused field stops below the page header with its label in view (80px).
          className="text-sm leading-normal [&_:is(input,select,textarea)]:scroll-mt-20"
          aria-label="Sửa tin đăng"
          noValidate
          onSubmit={handleSave}
        >
          {/* The edit stays as sent while the save is on its way. */}
          <fieldset disabled={isPosting} className="m-0 min-w-0 border-0 p-0">
            <div ref={mediaRef} className="scroll-mt-16">
              <MediaSection pipeline={pipeline} isPhotoMissing={isPhotoMissing} />
            </div>
            <ListingFields form={form} />
          </fieldset>

          <div className="mt-6">
            <ActionButton type="submit" disabled={isSubmitDisabled}>
              {isPosting ? 'Đang lưu…' : 'Lưu'}
            </ActionButton>
            {isWorking && (
              <p role="status" className={formNoteClass}>
                {saveMessages.working}
              </p>
            )}
          </div>
        </form>
      </main>
      <LeaveEditDialog
        isVisible={isLeaveAsked}
        onClose={() => setIsLeaveAsked(false)}
        onLeave={leave}
      />
    </>
  );
}
