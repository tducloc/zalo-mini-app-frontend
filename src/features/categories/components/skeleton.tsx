export default function CategoriesSkeleton() {
  return (
    <div className="category-scroll" role="status" aria-label="Đang tải danh mục" aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div className="category-item" key={index} aria-hidden="true">
          <div className="category-icon category-skeleton" />
          <div className="category-skeleton-label category-skeleton" />
        </div>
      ))}
    </div>
  );
}
