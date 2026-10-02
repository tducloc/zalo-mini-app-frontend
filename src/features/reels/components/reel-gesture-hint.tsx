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
  'absolute inset-x-0 top-0 bottom-[74px] z-[901] flex transform-gpu flex-col items-center justify-center overflow-y-auto bg-black/70 px-6 pb-6 pt-[calc(max(24px,var(--zaui-safe-area-inset-top,env(safe-area-inset-top,0px)))_+_44px)] text-white backdrop-blur-sm transition-opacity duration-200 [.has-draft-banner_&]:pb-[70px]';
const screenClass = 'relative h-11 w-7 overflow-hidden rounded-md ring-1 ring-white/30';
const fingerClass =
  'absolute bottom-0.5 right-1 text-white drop-shadow-[0_2px_3px_rgb(0_0_0/60%)] motion-reduce:animate-none';
const arrowClass = 'absolute left-1 top-1 hidden text-white/80 motion-reduce:block';

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
      aria-labelledby="reel-gesture-hint-title"
      aria-describedby="reel-gesture-hint-description"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onKeyDown={(event) => event.key === 'Escape' && dismiss()}
    >
      <div className="flex w-full max-w-[340px] animate-hint-pop flex-col items-center motion-reduce:animate-none">
        <h2
          id="reel-gesture-hint-title"
          className="m-0 text-center text-[22px] font-bold leading-7"
        >
          Lướt video, săn đồ hay!
        </h2>
        <p
          id="reel-gesture-hint-description"
          className="m-0 mt-1 text-center text-sm leading-5 text-white/80"
        >
          Chỉ cần 3 cử chỉ đơn giản
        </p>

        <ul className="m-0 mt-6 flex w-full list-none flex-col gap-2.5 p-0">
          <GestureRow title="Vuốt lên hoặc xuống" detail="Chuyển sang video khác">
            <span className={screenClass}>
              <span className="absolute inset-x-0 top-0 flex h-[200%] animate-hint-feed flex-col motion-reduce:animate-none">
                <span className="h-1/2 bg-gradient-to-br from-sky-400 to-indigo-500" />
                <span className="h-1/2 bg-gradient-to-br from-amber-300 to-rose-400" />
              </span>
            </span>
            <ArrowUpDown className={arrowClass} size={16} aria-hidden />
            <Pointer
              className={`${fingerClass} animate-hint-finger-y`}
              size={22}
              strokeWidth={2.2}
              aria-hidden
            />
          </GestureRow>

          <GestureRow title="Vuốt sang trái" detail="Xem chi tiết món đồ">
            <MiniDetail />
            <ArrowLeft className={arrowClass} size={16} aria-hidden />
            <Pointer
              className={`${fingerClass} animate-hint-finger-x`}
              size={22}
              strokeWidth={2.2}
              aria-hidden
            />
          </GestureRow>

          <GestureRow title="Vuốt sang phải" detail="Quay lại xem video">
            <MiniDetail isReturning />
            <ArrowRight className={arrowClass} size={16} aria-hidden />
            <Pointer
              className={`${fingerClass} animate-hint-finger-x [animation-direction:reverse]`}
              size={22}
              strokeWidth={2.2}
              aria-hidden
            />
          </GestureRow>
        </ul>

        <button
          ref={buttonRef}
          className="mt-7 h-12 w-full rounded-full border-0 bg-marketplace-blue text-base font-semibold text-white shadow-[0_6px_20px_rgb(0_104_255/40%)] active:bg-marketplace-blue-dark"
          type="button"
          onClick={dismiss}
        >
          Bắt đầu xem
        </button>
        <p className="m-0 mt-3 text-caption leading-4 text-white/70">
          Hoặc vuốt màn hình để xem ngay
        </p>
      </div>
    </div>
  );
}

function GestureRow({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3.5 rounded-2xl bg-white/10 p-2.5 pr-4 ring-1 ring-white/10">
      <span
        className="relative grid size-14 flex-none place-items-center rounded-xl bg-black/30"
        aria-hidden
      >
        {children}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold leading-5">{title}</span>
        <span className="text-caption leading-4 text-white/75">{detail}</span>
      </span>
    </li>
  );
}

/** A reel with a listing card sliding over it, or back off it when returning. */
function MiniDetail({ isReturning = false }: { isReturning?: boolean }) {
  return (
    <span className={`${screenClass} bg-gradient-to-br from-sky-400 to-indigo-500`}>
      <span
        className={`absolute inset-0 flex translate-x-1/2 animate-hint-reveal flex-col gap-0.5 bg-white p-0.5 motion-reduce:animate-none ${isReturning ? '[animation-direction:reverse]' : ''}`}
      >
        <span className="h-3.5 rounded-sm bg-amber-200" />
        <span className="h-1 w-5 rounded-full bg-marketplace-ink/60" />
        <span className="h-1 w-3 rounded-full bg-marketplace-blue" />
      </span>
    </span>
  );
}
