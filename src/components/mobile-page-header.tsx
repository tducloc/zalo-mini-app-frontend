import { Header, useLocation, useNavigate } from 'zmp-ui';

export default function MobilePageHeader({
  title,
  showBack = false,
  fallbackPath = '/',
  transparent = false,
}: {
  title: string;
  showBack?: boolean;
  fallbackPath?: string;
  transparent?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => {
    if (location.key === 'default') {
      navigate(fallbackPath);
      return;
    }
    navigate(-1);
  };

  return (
    <Header
      title={title}
      showBackIcon={showBack}
      onBackClick={goBack}
      className={transparent ? 'product-detail-header' : undefined}
      backgroundColor={transparent ? 'transparent' : undefined}
      textColor={transparent ? '#ffffff' : undefined}
    />
  );
}
