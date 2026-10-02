import { ArrowLeft, ArrowRight, ArrowUpDown, Pointer } from 'lucide-react';
import { type TouchEvent, useEffect, useRef, useState } from 'react';

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

/** One gesture moves at a time, so the eye follows them in order. */
const TURN_MS = 3000;
const GESTURES = [
  {
    label: 'Vuốt lên xuống\nđể đổi video',
    arrow: ArrowUpDown,
    arrowPlace: 'right-0 top-1/2 -translate-y-1/2',
    motion: 'animate-hint-finger-y',
  },
  {
    label: 'Vuốt sang trái\nđể xem chi tiết',
    arrow: ArrowLeft,
    arrowPlace: 'left-1/2 top-0 -translate-x-1/2',
    motion: 'animate-hint-finger-x',
  },
  {
    label: 'Vuốt sang phải\nđể quay lại',
    arrow: ArrowRight,
    arrowPlace: 'left-1/2 top-0 -translate-x-1/2',
    motion: 'animate-hint-finger-back',
  },
];

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export default function ReelGestureHint() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>(() =>
    hasSeenHint() ? 'gone' : 'shown',
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isReducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    if (isReducedMotion || phase !== 'shown') {
      return;
    }

    const timer = setInterval(
      () => setActiveIndex((index) => (index + 1) % GESTURES.length),
      TURN_MS,
    );
    return () => clearInterval(timer);
  }, [isReducedMotion, phase]);

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
      onClick={dismiss}
      onKeyDown={(event) => event.key === 'Escape' && dismiss()}
    >
      <div className="flex w-full max-w-[360px] animate-hint-pop flex-col items-center motion-reduce:animate-none">
        <ul className="m-0 flex list-none flex-col gap-8 p-0">
          {GESTURES.map((gesture, index) => {
            const isActive = isReducedMotion || index === activeIndex;
            const Arrow = gesture.arrow;

            return (
              <li
                key={gesture.label}
                className={`flex items-center gap-5 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-35'}`}
              >
                <span className="relative grid size-20 flex-none place-items-center" aria-hidden>
                  <Arrow className={`${arrowClass} ${gesture.arrowPlace}`} {...arrowProps} />
                  <Pointer
                    className={`${handClass} ${isActive && !isReducedMotion ? gesture.motion : ''}`}
                    {...handProps}
                  />
                </span>
                <span className="whitespace-pre text-base font-semibold leading-6">
                  {gesture.label}
                </span>
              </li>
            );
          })}
        </ul>

        {/* A tap anywhere closes it; this is the same for keyboards and screen readers. */}
        <button ref={buttonRef} className="sr-only" type="button" onClick={dismiss}>
          Đóng hướng dẫn
        </button>
      </div>
    </div>
  );
}
