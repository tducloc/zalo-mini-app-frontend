export default function DetailSkeleton() {
  return (
    <main className="product-detail-content product-detail-skeleton">
      <div className="product-detail-image-placeholder" />
      <div className="product-detail-skeleton-body">
        <div className="listing-line" />
        <div className="listing-line short" />
        <div className="listing-line" />
      </div>
    </main>
  );
}
