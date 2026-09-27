// @vitest-environment jsdom
// jsdom: the helpers live in their component files, which load zmp-ui.
import { describe, expect, it } from 'vitest';

import { resolveSheetVisibility, settleSheetClose } from '@/components/app-sheet';

const closed = { isShown: false, isClosing: false };

describe('sheet visibility', () => {
  it('opens and closes normally', () => {
    const open = resolveSheetVisibility(closed, true);
    expect(open).toEqual({ isShown: true, isClosing: false });

    const closing = resolveSheetVisibility(open, false);
    expect(closing).toEqual({ isShown: false, isClosing: true });
    expect(settleSheetClose(closing, false)).toEqual(closed);
  });

  it('holds a reopen until the close settles, then shows', () => {
    const closing = resolveSheetVisibility({ isShown: true, isClosing: false }, false);
    const reopenRequested = resolveSheetVisibility(closing, true);
    expect(reopenRequested).toEqual({ isShown: false, isClosing: true });

    expect(settleSheetClose(reopenRequested, true)).toEqual({ isShown: true, isClosing: false });
  });

  it('keeps the same state object when nothing changes', () => {
    expect(resolveSheetVisibility(closed, false)).toBe(closed);
  });
});
