import { useGoBack } from '@/hooks/use-go-back';
import { useSwipe } from '@/hooks/use-swipe';

/**
 * A thin strip down the left edge: swiping right from it goes back, as on iOS. Only from the
 * edge, so the gallery keeps its own sideways swipe. Under the header and the contact bar.
 */
export default function BackSwipeEdge() {
  const goBack = useGoBack('/');
  const swipeHandlers = useSwipe((direction) => direction === 'right' && goBack());

  return (
    <div
      className="fixed inset-y-0 left-0 z-[1] w-4 touch-none"
      aria-hidden="true"
      {...swipeHandlers}
    />
  );
}
