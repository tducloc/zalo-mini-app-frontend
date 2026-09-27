import { ComponentProps, Fragment, useState } from 'react';
import { Sheet } from 'zmp-ui';

type AppSheetProps = Omit<ComponentProps<typeof Sheet>, 'afterClose'>;

/**
 * zmp-ui Sheet that survives being reopened mid-close, and remounts its
 * content on every opening so forms start from fresh state.
 */
export default function AppSheet({ visible = false, children, ...sheetProps }: AppSheetProps) {
  const [state, setState] = useState({ isShown: visible, isClosing: false });

  const nextState = resolveSheetVisibility(state, visible);
  if (nextState !== state) {
    setState(nextState);
  }

  const openCount = useOpenCount(nextState.isShown);

  const handleAfterClose = () => setState((current) => settleSheetClose(current, visible));

  return (
    <Sheet {...sheetProps} visible={nextState.isShown} afterClose={handleAfterClose}>
      <Fragment key={openCount}>{children}</Fragment>
    </Sheet>
  );
}

/**
 * Increments each time `visible` turns true. Use it as a `key` to restart a
 * sheet's form state on every opening, instead of zmp-ui's `unmountOnClose`,
 * which unmounts in afterClose and leaves a sheet reopened during the close
 * animation stuck closed while `visible` is true.
 */
function useOpenCount(visible: boolean) {
  const [openCount, setOpenCount] = useState(0);
  const [wasVisible, setWasVisible] = useState(visible);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setOpenCount((count) => count + 1);
    }
  }

  return openCount;
}

export interface SheetVisibility {
  /** What the zmp-ui Sheet is told to show. */
  isShown: boolean;
  /** Between hiding the sheet and zmp-ui's afterClose. */
  isClosing: boolean;
}

/**
 * The next state for a requested `visible`. zmp-ui hides the sheet in a timer
 * that captures `visible=false`; reopening before it fires leaves the mask up
 * over a hidden sheet. So a reopen waits until the close has settled.
 */
export function resolveSheetVisibility(
  state: SheetVisibility,
  isRequested: boolean,
): SheetVisibility {
  const isShown = isRequested && !state.isClosing;
  if (isShown === state.isShown) {
    return state;
  }
  return { isShown, isClosing: state.isShown && !isShown };
}

/** zmp-ui finished closing; a pending reopen may now show. */
export function settleSheetClose(state: SheetVisibility, isRequested: boolean): SheetVisibility {
  return resolveSheetVisibility({ ...state, isClosing: false }, isRequested);
}
