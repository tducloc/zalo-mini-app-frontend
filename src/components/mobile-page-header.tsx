import { Header, useLocation, useNavigate } from 'zmp-ui';

export default function MobilePageHeader({
  title,
  showBack = false,
  fallbackPath = '/',
}: {
  title: string;
  showBack?: boolean;
  fallbackPath?: string;
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

  return <Header title={title} showBackIcon={showBack} onBackClick={goBack} />;
}
