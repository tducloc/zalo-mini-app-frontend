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
