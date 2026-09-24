import MobilePageHeader from '@/components/mobile-page-header';

/**
 * Transparent over the photo gallery; solid on loading/feedback screens,
 * where a white back arrow would vanish on the white page.
 */
export default function ProductDetailHeader({ isOverMedia = true }: { isOverMedia?: boolean }) {
  return <MobilePageHeader title="" showBack transparent={isOverMedia} />;
}
