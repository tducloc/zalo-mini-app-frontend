import { ArrowLeft, ArrowRight, ArrowUpDown, Pointer } from 'lucide-react';
import { type ReactNode, type TouchEvent, useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'reels-gesture-hint-seen';
const SWIPE_PX = 16;
const LEAVE_MS = 200;

// Kept when storage throws, so the hint still shows only once per app session.
let isSeenThisSession = false;

function hasSeenHint() {
  if (isSeenThisSession) {
    return true;
  }

  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markHintSeen() {
  isSeenThisSession = true;

  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode or blocked storage: the session flag above still holds.
  }
}

// Under the status bar and Zalo's 44px capsule row, above the 74px tab bar.
const dialogClass =
  'absolute inset-x-0 top-0 bottom-[74px] z-[901] flex transform-gpu flex-col items-center justify-center overflow-y-auto bg-black/65 px-4 pb-6 pt-[calc(max(24px,var(--zaui-safe-area-inset-top,env(safe-area-inset-top,0px)))_+_44px)] text-white transition-opacity duration-200 [.has-draft-banner_&]:pb-[70px]';
// A white line hand with the direction beside it, like TikTok's own hints.
const handClass = 'text-white motion-reduce:animate-none';
const handProps = { size: 44, strokeWidth: 1.5, 'aria-hidden': true } as const;
const arrowProps = { size: 22, strokeWidth: 2, 'aria-hidden': true } as const;
const arrowClass = 'absolute text-white/60';

export default function ReelGestureHint() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>(() =>
    hasSeenHint() ? 'gone' : 'shown',
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (phase !== 'leaving') {
      return;
    }

    const timer = setTimeout(() => setPhase('gone'), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone') {
    return null;
  }

  const dismiss = () => {
    markHintSeen();
    setPhase('leaving');
  };

  // Records only: a visible change on touchstart makes iOS drop the tap's click.
  const handleTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchMove = (event: TouchEvent) => {
    const start = touchStart.current;
    const touch = event.touches[0];
    if (phase !== 'shown' || !start || !touch) {
      return;
    }

    const distance = Math.max(Math.abs(touch.clientX - start.x), Math.abs(touch.clientY - start.y));
    if (distance >= SWIPE_PX) {
      dismiss();
    }
  };

  return (
    <div
      className={`${dialogClass} ${phase === 'leaving' ? 'pointer-events-none opacity-0' : 'animate-hint-fade'}`}
      role="dialog"
      aria-label="Hướng dẫn lướt video"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onKeyDown={(event) => event.key === 'Escape' && dismiss()}
    >
      <div className="flex w-full max-w-[360px] animate-hint-pop flex-col items-center motion-reduce:animate-none">
        <ul className="m-0 flex list-none flex-col gap-8 p-0">
          <Gesture label={'Vuốt lên xuống\nđể đổi video'}>
            <ArrowUpDown
              className={`${arrowClass} right-0 top-1/2 -translate-y-1/2`}
              {...arrowProps}
            />
            <Pointer className={`${handClass} animate-hint-finger-y`} {...handProps} />
          </Gesture>

          <Gesture label={'Vuốt sang trái\nđể xem chi tiết'}>
            <ArrowLeft
              className={`${arrowClass} left-1/2 top-0 -translate-x-1/2`}
              {...arrowProps}
            />
            <Pointer className={`${handClass} animate-hint-finger-x`} {...handProps} />
          </Gesture>

          <Gesture label={'Vuốt sang phải\nđể quay lại'}>
            <ArrowRight
              className={`${arrowClass} left-1/2 top-0 -translate-x-1/2`}
              {...arrowProps}
            />
            <Pointer className={`${handClass} animate-hint-finger-back`} {...handProps} />
          </Gesture>
        </ul>

        <button
          ref={buttonRef}
          className="mt-12 h-12 min-w-[180px] rounded-full border-0 bg-marketplace-blue px-8 text-base font-semibold text-white active:bg-marketplace-blue-dark"
          type="button"
          onClick={dismiss}
        >
          Bắt đầu xem
        </button>
      </div>
    </div>
  );
}

function Gesture({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-5">
      <span className="relative grid size-20 flex-none place-items-center" aria-hidden>
        {children}
      </span>
      <span className="whitespace-pre text-base font-semibold leading-6">{label}</span>
    </li>
  );
}
