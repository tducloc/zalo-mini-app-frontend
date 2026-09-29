import MobilePageHeader from '@/components/layout/mobile-page-header';

/**
 * Transparent over the photo gallery; solid on loading/feedback screens,
 * where a white back arrow would vanish on the white page.
 */
export default function ProductDetailHeader({
  isOverMedia = true,
  onBack,
}: {
  isOverMedia?: boolean;
  onBack?: () => void;
}) {
  return <MobilePageHeader title="" showBack transparent={isOverMedia} onBack={onBack} />;
}
