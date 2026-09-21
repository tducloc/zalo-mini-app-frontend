import { useState } from 'react';

const COLLAPSE_THRESHOLD = 180;

export default function ProductDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = description.length > COLLAPSE_THRESHOLD;

  return (
    <section className="product-detail-description">
      <h2>Mô tả sản phẩm</h2>
      <p className={canToggle && !expanded ? 'is-collapsed' : undefined}>{description}</p>
      {canToggle && (
        <button onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}
