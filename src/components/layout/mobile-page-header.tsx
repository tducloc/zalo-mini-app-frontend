import { Header, Icon } from 'zmp-ui';

import { useGoBack } from '@/hooks/use-go-back';

// Over media: no divider, and the back arrow on a dark disc.
const transparentHeaderClass =
  'after:hidden [&_.zaui-header-back]:rounded-full [&_.zaui-header-back]:bg-black/45';

export default function MobilePageHeader({
  title,
  showBack = false,
  fallbackPath = '/',
  transparent = false,
  onBack,
}: {
  title: string;
  showBack?: boolean;
  fallbackPath?: string;
  transparent?: boolean;
  /** Replaces going back, e.g. to ask first when there are unsaved changes. */
  onBack?: () => void;
}) {
  const goBack = useGoBack(fallbackPath);

  return (
    <Header
      title={title}
      showBackIcon={showBack}
      // zmp-ui renders an icon-only button; the label gives it a name.
      backIcon={
        <span aria-label="Quay lại" className="inline-flex" role="img">
          <Icon icon="zi-chevron-left" />
        </span>
      }
      onBackClick={onBack ?? goBack}
      className={transparent ? transparentHeaderClass : undefined}
      backgroundColor={transparent ? 'transparent' : undefined}
      textColor={transparent ? '#ffffff' : undefined}
    />
  );
}
