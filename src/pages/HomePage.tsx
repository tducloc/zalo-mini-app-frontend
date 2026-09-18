import { useState } from 'react';
import { Button, Icon, Page, Sheet } from 'zmp-ui';

import { categories as categoryPresentation } from '@/features/categories/CategoriesConstants';
import { useCategories } from '@/features/categories/CategoriesQuery';
import CategoriesSkeleton from '@/features/categories/CategoriesSkeleton';

const featuredListings = [
  {
    title: 'iPhone 13 128GB',
    price: '6.990.000 đ',
    meta: 'Hà Nội · 2 giờ trước',
    image:
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=500&q=80',
  },
  {
    title: 'Ghế văn phòng công thái học',
    price: '1.200.000 đ',
    meta: 'Hà Nội · 4 giờ trước',
    image:
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=500&q=80',
  },
  {
    title: 'Giày thể thao Nike Air',
    price: '850.000 đ',
    meta: 'Hà Nội · 6 giờ trước',
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80',
  },
  {
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

function HomePage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const categoryQuery = useCategories();
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
        {categoryQuery.isPending ? (
          <CategoriesSkeleton />
        ) : categoryQuery.isError && !categoryQuery.data ? (
          <div className="category-feedback" role="status">
            Không tải được danh mục.{' '}
            <button onClick={() => categoryQuery.refetch()}>Thử lại</button>
          </div>
        ) : categories.length === 0 ? (
          <p className="category-feedback">Chưa có danh mục.</p>
        ) : (
          <div className="category-scroll">
            {categories.map((category) => (
              <button className="category-item border-0 bg-transparent p-0" key={category.id}>
                <span className={`category-icon category-icon-${category.color}`}>
                  <Icon icon={category.icon} size={25} />
                </span>
                {category.label}
              </button>
            ))}
          </div>
        )}
        <div className="section-heading">
          <span>Tin đăng nổi bật</span>
        </div>
        {featuredListings.length ? (
          <div className="listing-grid">
            {featuredListings.map((listing) => (
              <article className="marketplace-card listing-card" key={listing.title}>
                <div className="listing-image-wrap">
                  <img src={listing.image} alt="" className="listing-product-image" />
                  <button className="listing-favorite" aria-label={`Lưu ${listing.title}`}>
                    <Icon icon="zi-heart" size={17} />
                  </button>
                </div>
                <div className="listing-copy">
                  <h2>{listing.title}</h2>
                  <p className="listing-price">{listing.price}</p>
                  <p className="listing-meta">
                    <Icon icon="zi-location" size={14} /> {listing.meta}
                  </p>
                </div>
              </article>
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
