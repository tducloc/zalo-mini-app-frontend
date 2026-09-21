export default function AuthLoadingScreen() {
  return (
    <main className="auth-initial-loading" aria-busy="true" aria-label="Đang chuẩn bị ứng dụng">
      <div className="auth-initial-loading-content">
        <span className="auth-initial-loading-mark" aria-hidden="true">
          Z
        </span>
        <strong>Chợ Zalo</strong>
        <span>Đang chuẩn bị trải nghiệm</span>
        <i className="auth-loader" aria-hidden="true" />
      </div>
    </main>
  );
}
