import MediaSection from '@/features/listings/components/media-section';

/**
 * The sell page's form, on the listing draft (plans/create-listing.md, "L6 in phases").
 * Media so far (L6.4); the fields and Post follow in L6.5 and L6.6.
 */
export default function CreateListingForm() {
  return (
    <div className="listing-form">
      <MediaSection />
    </div>
  );
}
