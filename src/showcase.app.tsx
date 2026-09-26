import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App, Sheet, ZMPRouter } from 'zmp-ui';
import 'zmp-ui/zaui.css';

import AuthRetryNotice from '@/features/auth/components/auth-retry-notice';
import ListingForm, { FormState } from '@/features/listings/components/showcase-listing-form';

import './css/tailwind.scss';
import './css/app.scss';
import './css/showcase.scss';
import AppShell from './components/app-shell';
import FeedbackState from './components/feedback-state';
import Price from './components/price';
import HomePage from './pages/home';
import { installShowcaseApi, isShowcaseFeedState } from './showcase-api';
const screens = [
  ['home', 'Trang chủ'],
  ['processing', 'Tin nháp đang xử lý'],
  ['filter', 'Bộ lọc'],
  ['detail', 'Chi tiết tin'],
  ['sell', 'Đăng tin'],
  ['ready', 'Ảnh đã chọn'],
  ['validation', 'Lỗi nhập liệu'],
  ['uploading', 'Đang tải ảnh'],
  ['upload-error', 'Lỗi tải ảnh'],
  ['success', 'Đăng thành công'],
  ['edit', 'Sửa tin'],
  ['manage', 'Quản lý tin'],
  ['profile', 'Cá nhân'],
  ['loading', 'Đang tải'],
  ['empty', 'Không có kết quả'],
  ['error', 'Lỗi kết nối'],
  ['auth', 'Lỗi xác thực'],
  ['sold', 'Tin đã bán'],
  ['missing', 'Tin không tồn tại'],
];
const photo =
  'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=500&q=80';
function ListingSummary({ onEdit, onStatus }: { onEdit?: () => void; onStatus?: () => void }) {
  return (
    <article className="review-listing marketplace-card">
      <img src={photo} alt="iPhone 13 màu xanh" />
      <div className="review-listing-copy">
        <h3>iPhone 13 128GB</h3>
        <Price value={6990000} />
        <p className="ui-muted">Hà Nội · 2 giờ trước</p>
      </div>
      {onEdit && (
        <button className="listing-menu-trigger" aria-label="Tùy chọn tin đăng" onClick={onEdit}>
          •••
        </button>
      )}
      {onStatus && (
        <button className="listing-status-action" onClick={onStatus}>
          Đang bán
        </button>
      )}
    </article>
  );
}
// Which tab the shell highlights for each showcase screen (forms default to "Đăng tin").
const tabPathByScreen: Record<string, string> = {
  home: '/',
  processing: '/',
  manage: '/my-listings',
  profile: '/profile',
  detail: '/products/preview',
  sold: '/products/preview',
};
const screenByTabPath: Record<string, string> = {
  '/': 'home',
  '/sell': 'sell',
  '/my-listings': 'manage',
  '/profile': 'profile',
};

function getPreviewPath(screen: string) {
  return tabPathByScreen[screen] ?? '/sell';
}

function Frame({ screen }: { screen: string }) {
  const [recovered, setRecovered] = useState(false);

  const [tab, setTab] = useState('Đang bán');

  const [dialog, setDialog] = useState('');

  const [listingMenuOpen, setListingMenuOpen] = useState(false);

  const title = screens.find((s) => s[0] === screen)?.[1] || 'Chợ Zalo';
  const formStates = [
    'sell',
    'ready',
    'validation',
    'uploading',
    'upload-error',
    'success',
    'edit',
  ];
  const isDetailScreen = screen === 'detail' || screen === 'sold';
  return (
    <App>
      <ZMPRouter memoryRouter>
        <AppShell
          previewPath={getPreviewPath(screen)}
          onPreviewNavigate={(path) =>
            location.assign(`?screen=${screenByTabPath[path] ?? 'home'}`)
          }
        >
          {['home', 'processing', 'filter', 'auth', 'loading', 'empty', 'error'].includes(
            screen,
          ) ? (
            <>
              <HomePage initialFilterOpen={screen === 'filter'} />
              <span className="home-zalo-control" aria-label="Zalo app controls">
                •••　◯
              </span>
            </>
          ) : (
            <div
              className={`marketplace-page review-page ${isDetailScreen ? 'review-detail-page' : ''}`}
            >
              <header className={isDetailScreen ? 'review-detail-header' : 'review-header'}>
                <button
                  className={isDetailScreen ? 'review-detail-back' : 'review-back'}
                  aria-label="Quay lại"
                  onClick={() => location.assign('?screen=home')}
                >
                  ‹
                </button>
                {!isDetailScreen && <span>{title}</span>}
                <span className="zalo-control">••• │ ◯</span>
              </header>
              <main
                className={`marketplace-content review-content ${isDetailScreen ? 'review-detail-content' : ''}`}
              >
                {formStates.includes(screen) ? (
                  <ListingForm demo state={(screen === 'sell' ? 'default' : screen) as FormState} />
                ) : isDetailScreen ? (
                  <>
                    <div className="review-detail-gallery">
                      <img src={photo} alt="Ảnh chính iPhone 13" />
                      <span>1 / 4</span>
                    </div>
                    <div className="review-detail-body">
                      {screen !== 'sold' && (
                        <button className="review-report">Báo cáo tin đăng</button>
                      )}
                      <p className="ui-muted">Điện tử · Như mới</p>
                      <h1>iPhone 13 128GB</h1>
                      <Price value={6990000} />
                      <p className="ui-muted">Hà Nội · Đăng 2 giờ trước</p>
                      <h2>Mô tả sản phẩm</h2>
                      <p>
                        Máy sử dụng tốt, màn hình đẹp. Có hộp và cáp sạc. Xem máy trực tiếp tại Cầu
                        Giấy, Hà Nội.
                      </p>
                      <section className="seller-card">
                        <span className="avatar">MA</span>
                        <div>
                          <b>Minh Anh</b>
                          <p className="ui-muted">Người bán</p>
                        </div>
                      </section>
                      <button
                        className="ui-button"
                        disabled={screen === 'sold'}
                        onClick={() =>
                          setDialog(
                            'Demo liên hệ: mở Zalo hoặc gọi điện khi có thông tin người bán hợp lệ.',
                          )
                        }
                      >
                        {screen === 'sold' ? 'Sản phẩm đã bán' : 'Liên hệ người bán'}
                      </button>
                    </div>
                  </>
                ) : screen === 'manage' ? (
                  <>
                    <div className="review-tabs">
                      {['Đang bán', 'Đã bán', 'Đã ẩn'].map((t) => (
                        <button
                          className={t === tab ? 'selected' : ''}
                          onClick={() => setTab(t)}
                          key={t}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <ListingSummary
                      onEdit={() => setListingMenuOpen(true)}
                      onStatus={() =>
                        setDialog('Xác nhận đổi trạng thái tin? Đây là thao tác demo.')
                      }
                    />
                  </>
                ) : screen === 'profile' ? (
                  <>
                    <section className="seller-card">
                      <span className="avatar">MA</span>
                      <div>
                        <h2>Minh Anh</h2>
                        <p className="ui-muted">Tài khoản Zalo · Dữ liệu mẫu</p>
                      </div>
                    </section>
                    <div className="profile-nav-list">
                      <button
                        className="profile-link"
                        onClick={() => location.assign('?screen=manage')}
                      >
                        <span className="profile-link-icon">▤</span>
                        <span>
                          <b>Quản lý tin</b>
                          <small>Xem tin bạn đang đăng</small>
                        </span>
                        <i>›</i>
                      </button>
                      <button
                        className="profile-link"
                        onClick={() => location.assign('?screen=sell')}
                      >
                        <span className="profile-link-icon">＋</span>
                        <span>
                          <b>Đăng tin mới</b>
                          <small>Tạo một tin để bán sản phẩm</small>
                        </span>
                        <i>›</i>
                      </button>
                    </div>
                  </>
                ) : recovered ? (
                  <ListingSummary />
                ) : (
                  // Only the "missing" screen reaches here; Home states render the real page.
                  <FeedbackState
                    type="empty"
                    title="Tin không còn tồn tại"
                    description="Tin có thể đã được người bán gỡ."
                    onAction={() => setRecovered(true)}
                  />
                )}
              </main>
            </div>
          )}
          {screen === 'auth' && !recovered && (
            <AuthRetryNotice onRetry={() => setRecovered(true)} />
          )}
          {dialog && (
            <div className="review-dialog">
              <section role="dialog" aria-modal="true" aria-label="Xác nhận thao tác">
                <h2>Xác nhận</h2>
                <p>{dialog}</p>
                <button
                  className="ui-button"
                  onClick={() => {
                    setDialog('');
                    setTab('Đã bán');
                  }}
                >
                  Xác nhận
                </button>
                <button className="text-action" onClick={() => setDialog('')}>
                  Hủy
                </button>
              </section>
            </div>
          )}
          <Sheet
            visible={screen === 'manage' && listingMenuOpen}
            title="Tùy chọn tin đăng"
            autoHeight
            unmountOnClose
            onClose={() => setListingMenuOpen(false)}
          >
            <div className="listing-action-sheet">
              <button onClick={() => location.assign('?screen=edit')}>Sửa tin</button>
              <button
                onClick={() => {
                  setListingMenuOpen(false);
                  setDialog('Xác nhận đổi trạng thái tin? Đây là thao tác demo.');
                }}
              >
                Đánh dấu đã bán
              </button>
              <button
                className="danger"
                onClick={() => {
                  setListingMenuOpen(false);
                  setDialog('Ẩn tin này khỏi danh sách công khai?');
                }}
              >
                Ẩn tin
              </button>
              <button className="cancel" onClick={() => setListingMenuOpen(false)}>
                Hủy
              </button>
            </div>
          </Sheet>
        </AppShell>
      </ZMPRouter>
    </App>
  );
}
function Showcase() {
  const [selected, setSelected] = useState('home');

  const [all, setAll] = useState(false);

  const [width, setWidth] = useState(390);
  return (
    <div className="showcase">
      <aside>
        <p className="eyebrow">CHỢ ZALO / DESIGN REVIEW</p>
        <h1>
          Một giao diện.
          <br />
          Mọi trạng thái.
        </h1>
        <p>UI từ code thật · React + ZaUI</p>
        <label>
          Kích thước{' '}
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))}>
            <option value={390}>iPhone 13 · 390px</option>
            <option value={375}>Mobile · 375px</option>
          </select>
        </label>
        <button className="ui-button" onClick={() => setAll(!all)}>
          {all ? 'Xem từng màn' : 'Xem toàn bộ màn'}
        </button>
        <nav>
          {screens.map(([id, label]) => (
            <button
              className={selected === id ? 'selected' : ''}
              onClick={() => {
                setSelected(id);
                setAll(false);
              }}
              key={id}
            >
              {label}
            </button>
          ))}
        </nav>
        <p className="ui-muted">
          Giới hạn ảnh tạm theo API: 10 ảnh tổng cộng. Gửi tin, upload và liên hệ trong showcase là
          mô phỏng.
        </p>
      </aside>
      <div className="review-canvas">
        {(all ? screens : screens.filter((s) => s[0] === selected)).map(([id, label]) => (
          <section className="review-board" key={id}>
            <h2>{label}</h2>
            <p>Chợ Zalo · {width} × 844</p>
            <iframe title={label} src={`?screen=${id}`} style={{ width, height: 844 }} />
            <a href={`?screen=${id}`} target="_blank" rel="noreferrer">
              Mở màn riêng ↗
            </a>
          </section>
        ))}
      </div>
    </div>
  );
}
const screen = new URLSearchParams(location.search).get('screen');
installShowcaseApi(isShowcaseFeedState(screen) ? screen : 'default');
createRoot(document.getElementById('app')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {screen ? <Frame screen={screen} /> : <Showcase />}
  </QueryClientProvider>,
);
