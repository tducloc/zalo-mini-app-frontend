import { useState } from 'react';
import { Button, Icon, Page, Sheet, useNavigate } from 'zmp-ui';

import FeedbackState from '@/components/feedback-state.component';
import { categories as categoryPresentation } from '@/features/categories/categories.constants';
import { useCategories } from '@/features/categories/categories.query';
import CategoriesSkeleton from '@/features/categories/categories-skeleton.component';

const featuredListings = [
  {
    id: 'prd_iphone_13',
    title: 'iPhone 13 128GB',
    price: '6.990.000 đ',
    meta: 'Hà Nội · 2 giờ trước',
    image:
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 'prd_chair_sold',
    title: 'Ghế văn phòng công thái học',
    price: '1.200.000 đ',
    meta: 'Hà Nội · 4 giờ trước',
    image:
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 'prd_demo_video',
    title: 'Giày thể thao Nike Air',
    price: '850.000 đ',
    meta: 'Hà Nội · 6 giờ trước',
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 'prd_laptop_air',
    title: 'MacBook Air M1 256GB',
    price: '8.500.000 đ',
    meta: 'Hà Nội · 1 ngày trước',
    image:
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=500&q=80',
  },
];

function LoadingGrid() {
  return (
    <div className="listing-grid">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="marketplace-card listing-placeholder" key={index}>
          <div className="listing-image" />
          <div className="listing-line" />
          <div className="listing-line short" />
        </div>
      ))}
    </div>
  );
}

function HomePage({
  preview = false,
  initialFilter = false,
  state = 'default',
}: {
  preview?: boolean;
  initialFilter?: boolean;
  state?: 'default' | 'loading' | 'empty' | 'error';
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(initialFilter);
  const navigate = useNavigate();
  const liveQuery = useCategories(!preview);
  const categoryQuery = preview
    ? {
        data: categoryPresentation.map((c) => ({ ...c, name: c.label })),
        isPending: false,
        isError: false,
        refetch: () => {},
      }
    : liveQuery;
  const categories = (categoryQuery.data ?? []).map((category) => ({
    ...category,
    label: category.name,
    icon:
      categoryPresentation.find((item) => item.id === category.id)?.icon ??
      ('zi-more-grid' as const),
    color: categoryPresentation.find((item) => item.id === category.id)?.color ?? 'purple',
  }));

  return (
    <Page className="marketplace-page marketplace-home-page">
      <header className="marketplace-home-header">
        <h1 className="marketplace-home-title">Chợ Zalo</h1>
        {preview && (
          <span className="home-zalo-control" aria-label="Zalo app controls">
            •••　◯
          </span>
        )}
        <div className="marketplace-search-bar">
          <div className="marketplace-search">
            <Icon icon="zi-search" />
            <input aria-label="Tìm kiếm tin đăng" placeholder="Tìm kiếm" />
            <button
              aria-label="Mở bộ lọc"
              className="border-0 bg-transparent p-0"
              onClick={() => setIsFilterOpen(true)}
            >
              <Icon icon="zi-filter" />
            </button>
          </div>
          <button className="header-icon-button" aria-label="Thông báo">
            <Icon icon="zi-notif" size={24} />
          </button>
        </div>
      </header>

      <main className="marketplace-content">
        <div className="section-heading">
          <span>Danh mục</span>
          <button className="section-link">
            Xem tất cả <Icon icon="zi-chevron-right" size={14} />
          </button>
        </div>
        {state === 'loading' || categoryQuery.isPending ? (
          <CategoriesSkeleton />
        ) : state === 'error' || (categoryQuery.isError && !categoryQuery.data) ? (
          <div className="category-feedback" role="status">
            Không tải được danh mục.{' '}
            <button onClick={() => categoryQuery.refetch()}>Thử lại</button>
          </div>
        ) : categories.length === 0 ? (
          <p className="category-feedback">Chưa có danh mục.</p>
        ) : (
          <div className="category-scroll">
            {categories.map((category) => (
              <button
                disabled={category.id === 'cat_others'}
                className="category-item border-0 bg-transparent p-0"
                key={category.id}
              >
                <span className={`category-icon category-icon-${category.color}`}>
                  <Icon icon={category.icon} size={25} />
                </span>
                {category.label}
              </button>
            ))}
          </div>
        )}
        <div className="section-heading">
          <span>Tin đăng mới</span>
        </div>
        {state === 'loading' ? (
          <LoadingGrid />
        ) : state === 'empty' ? (
          <FeedbackState
            type="empty"
            title="Chưa tìm thấy sản phẩm"
            description="Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc."
          />
        ) : state === 'error' ? (
          <FeedbackState
            type="error"
            title="Không tải được tin"
            description="Kiểm tra kết nối mạng và thử lại."
            onRetry={() => categoryQuery.refetch()}
          />
        ) : featuredListings.length ? (
          <div className="listing-grid">
            {featuredListings.map((listing) => (
              <button
                aria-label={`Xem chi tiết ${listing.title}`}
                className="marketplace-card listing-card"
                key={listing.id}
                onClick={() => navigate(`/products/${listing.id}`)}
              >
                <div className="listing-image-wrap">
                  <img src={listing.image} alt="" className="listing-product-image" />
                </div>
                <div className="listing-copy">
                  <h2>{listing.title}</h2>
                  <p className="listing-price">{listing.price}</p>
                  <p className="listing-meta">
                    <Icon icon="zi-location" size={14} /> {listing.meta}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <LoadingGrid />
        )}
      </main>

      <Sheet
        visible={isFilterOpen}
        title="Lọc tin đăng"
        autoHeight
        onClose={() => setIsFilterOpen(false)}
        unmountOnClose
      >
        <div className="p-4">
          <p className="m-0 text-sm font-semibold">Danh mục</p>
          {categoryQuery.isPending ? (
            <CategoriesSkeleton />
          ) : categoryQuery.isError && !categoryQuery.data ? (
            <div className="category-feedback">
              Không tải được danh mục.{' '}
              <button onClick={() => categoryQuery.refetch()}>Thử lại</button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
                  key={category.id}
                >
                  {category.label}
                </button>
              ))}
            </div>
          )}
          <p className="mb-2 mt-5 text-sm font-semibold">Khu vực</p>
          <button className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-500">
            Hà Nội <span className="float-right">⌄</span>
          </button>
          <p className="mb-2 mt-5 text-sm font-semibold">Khoảng giá</p>
          <div className="flex gap-2">
            <input
              className="w-1/2 rounded-xl border border-slate-200 p-3 text-sm"
              inputMode="numeric"
              placeholder="Từ"
            />
            <input
              className="w-1/2 rounded-xl border border-slate-200 p-3 text-sm"
              inputMode="numeric"
              placeholder="Đến"
            />
          </div>
          <div className="mt-6 flex gap-3">
            <Button fullWidth variant="tertiary" onClick={() => setIsFilterOpen(false)}>
              Xoá lọc
            </Button>
            <Button fullWidth onClick={() => setIsFilterOpen(false)}>
              Áp dụng
            </Button>
          </div>
        </div>
      </Sheet>
    </Page>
  );
}

export default HomePage;
