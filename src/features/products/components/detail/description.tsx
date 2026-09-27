import { useState } from 'react';

const COLLAPSE_THRESHOLD = 180;

export default function ProductDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = description.length > COLLAPSE_THRESHOLD;

  return (
    <section className="border-b border-solid border-marketplace-line py-[18px]">
      <h2 className="m-0 text-base leading-[22px]">Mô tả sản phẩm</h2>
      <p
        className={`mb-0 mt-[9px] whitespace-pre-wrap text-sm leading-[21px] text-marketplace-ink ${canToggle && !expanded ? 'line-clamp-5' : ''}`}
      >
        {description}
      </p>
      {canToggle && (
        <button
          className="mt-1 min-h-9 border-0 px-0 py-1.5 text-sm font-semibold leading-normal text-marketplace-blue"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}
