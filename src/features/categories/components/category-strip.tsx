import InlineRetry from '@/components/inline-retry';
import Skeleton from '@/components/skeleton';
import type { CategoryOption } from '@/features/categories/types/category';

const SKELETON_ITEMS = 5;

const stripClass =
  'flex justify-between gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const itemClass = 'flex-[0_0_62px] text-center text-xs leading-[17px]';
const iconClass = 'mx-auto mb-1.5 grid size-[52px] place-items-center rounded-full';
// Error/empty states keep the strip's height so the feed below does not jump.
const stripPlaceholderClass = 'min-h-[79px]';

interface CategoryStripProps {
  categories: CategoryOption[] | undefined;
  isPending: boolean;
  isError: boolean;
  selectedId: string | undefined;
  onRetry: () => void;
  onSelect: (categoryId: string) => void;
}

export default function CategoryStrip({
  categories,
  isPending,
  isError,
  selectedId,
  onRetry,
  onSelect,
}: CategoryStripProps) {
  if (isPending) {
    return <CategoryStripSkeleton />;
  }

  if (isError && !categories) {
    return (
      <InlineRetry
        className={stripPlaceholderClass}
        message="Không tải được danh mục."
        onRetry={onRetry}
      />
    );
  }

  if (!categories?.length) {
    return (
      <p className={`m-0 py-4 text-caption text-marketplace-muted ${stripPlaceholderClass}`}>
        Chưa có danh mục.
      </p>
    );
  }

  return (
    <div className={stripClass} role="group" aria-label="Lọc theo danh mục">
      {categories.map((category) => {
        const isSelected = category.id === selectedId;

        return (
          <button
            aria-pressed={isSelected}
            className={`${itemClass} group border-0 bg-transparent p-0 ${
              isSelected ? 'font-semibold text-marketplace-blue' : 'text-marketplace-ink'
            }`}
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
          >
            <span
              className={`${iconClass} border-2 border-transparent transition-colors duration-150 ease-out group-focus-visible:border-marketplace-blue-dark ${
                isSelected
                  ? 'bg-marketplace-blue text-white'
                  : 'bg-marketplace-pale text-marketplace-blue'
              }`}
            >
              <category.icon aria-hidden="true" size={24} strokeWidth={1.75} />
            </span>
            {category.label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryStripSkeleton() {
  return (
    <div className={stripClass} role="status" aria-label="Đang tải danh mục" aria-busy="true">
      {Array.from({ length: SKELETON_ITEMS }, (_, index) => (
        <div className={itemClass} key={index}>
          <Skeleton className={iconClass} />
          <Skeleton className="mx-auto mb-[3px] mt-2 h-3 w-[46px] rounded" />
        </div>
      ))}
    </div>
  );
}
