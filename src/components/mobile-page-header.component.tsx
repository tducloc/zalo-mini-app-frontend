import { Header, useNavigate } from 'zmp-ui';

export default function MobilePageHeader({
  title,
  showBack = false,
}: {
  title: string;
  showBack?: boolean;
}) {
  const navigate = useNavigate();
  return <Header title={title} showBackIcon={showBack} onBackClick={() => navigate(-1)} />;
}
