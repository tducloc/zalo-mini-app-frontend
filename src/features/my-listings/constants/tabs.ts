import type { MyListingsTab } from '@/features/my-listings/types/my-listing';
import type { ProductStatus } from '@/features/products/types/product';

/** In the order they show; other pages may open one with `navigate('/my-listings', { state: { tab } })`. */
export const MY_LISTINGS_TABS = ['published', 'processing', 'sold', 'archived'] as const;

export const DEFAULT_TAB: MyListingsTab = 'published';

interface TabConfig {
  label: string;
  statuses: ProductStatus[];
  empty: { title: string; description: string };
}

export const tabConfigs: Record<MyListingsTab, TabConfig> = {
  published: {
    label: 'Đang hiển thị',
    statuses: ['PUBLISHED'],
    empty: {
      title: 'Chưa có tin đang hiển thị',
      description: 'Tin đã đăng và xử lý xong sẽ hiện với người mua tại đây.',
    },
  },
  processing: {
    label: 'Đang xử lý',
    statuses: ['PROCESSING', 'FAILED'],
    empty: {
      title: 'Không có tin đang xử lý',
      description: 'Tin mới đăng nằm ở đây trong lúc ảnh và video được xử lý.',
    },
  },
  sold: {
    label: 'Đã bán',
    statuses: ['SOLD'],
    empty: {
      title: 'Chưa có tin đã bán',
      description: 'Tin bạn đánh dấu đã bán sẽ nằm ở đây.',
    },
  },
  archived: {
    label: 'Đã ẩn',
    statuses: ['ARCHIVED'],
    empty: {
      title: 'Không có tin đã ẩn',
      description: 'Tin bạn ẩn khỏi trang chủ nằm ở đây, và có thể hiện lại bất cứ lúc nào.',
    },
  },
};
