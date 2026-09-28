/**
 * Which feed card plays its preview (plans/home-feed.md, Phase 4): one at a time, a card of
 * the row nearest the middle of the screen, and never when the viewer asked for less motion
 * or less data.
 */

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A card must show this share of its height to be picked. */
const MIN_VISIBLE_SHARE = 0.6;

/** Cards whose vertical centres are this close sit in one row (rounding moves a top by a pixel). */
const ROW_TOLERANCE_PX = 8;

/** Networks too slow to spend on previews. */
const SLOW_NETWORKS = new Set(['slow-2g', '2g']);

const centre = (start: number, end: number) => (start + end) / 2;

/**
 * The part of the scroller the viewer really sees: the fixed header covers its top, and
 * its bottom padding is kept free for the tab bar (and the draft banner) over it.
 */
export function visibleArea(scroller: Box, headerBottom: number, bottomPadding: number): Box {
  return {
    ...scroller,
    top: Math.max(scroller.top, headerBottom),
    bottom: scroller.bottom - bottomPadding,
  };
}

/**
 * Whose turn it is to play. First the middle row: the row, among those with a card mostly
 * in the visible area, whose centre is nearest the centre of that area. Then, of that
 * row's cards mostly in it and not yet `finished`, the one nearest the centre across; of
 * two as near, the first (the left one) wins. Once the whole middle row has finished, none
 * plays, even when the next row is fully visible. A card leaves `finished` once no part of
 * it is visible, so scrolling back plays it again.
 */
export function pickActiveCard(
  cards: { id: string; rect: Box }[],
  area: Box,
  finished: ReadonlySet<string>,
) {
  const middleY = centre(area.top, area.bottom);
  const middleX = centre(area.left, area.right);

  const stillFinished = new Set<string>();
  const mostlyVisible: { id: string; rect: Box; centreY: number }[] = [];
  for (const { id, rect } of cards) {
    const height = rect.bottom - rect.top;
    const visible = Math.min(rect.bottom, area.bottom) - Math.max(rect.top, area.top);
    // A zero-size box is a card that is not laid out (hidden), not a visible one.
    if (height <= 0 || visible <= 0) {
      continue;
    }
    if (finished.has(id)) {
      stillFinished.add(id);
    }
    if (visible >= height * MIN_VISIBLE_SHARE) {
      mostlyVisible.push({ id, rect, centreY: centre(rect.top, rect.bottom) });
    }
  }

  // Finished cards count here: a middle row that has played keeps its place, silent.
  let rowY: number | null = null;
  for (const { centreY } of mostlyVisible) {
    if (rowY === null || Math.abs(centreY - middleY) < Math.abs(rowY - middleY)) {
      rowY = centreY;
    }
  }

  let best: { id: string; distance: number } | null = null;
  for (const { id, rect, centreY } of mostlyVisible) {
    if (rowY === null || Math.abs(centreY - rowY) > ROW_TOLERANCE_PX || finished.has(id)) {
      continue;
    }
    // Across only: a pixel of rounding between two tops must not put the right card first.
    const distance = Math.abs(centre(rect.left, rect.right) - middleX);
    if (!best || distance < best.distance) {
      best = { id, distance };
    }
  }
  return { activeId: best?.id ?? null, finished: stillFinished };
}

export function canAutoplay({
  isEnabled,
  wasRefused,
  prefersReducedMotion,
  saveData,
  effectiveType,
}: {
  isEnabled: boolean;
  /** The WebView refused to play a preview this session; it will refuse the next too. */
  wasRefused: boolean;
  prefersReducedMotion: boolean;
  /** From the Network Information API; undefined where the browser has none. */
  saveData: boolean | undefined;
  effectiveType: string | undefined;
}) {
  const isSlowNetwork = SLOW_NETWORKS.has(effectiveType ?? '');
  return isEnabled && !wasRefused && !prefersReducedMotion && !saveData && !isSlowNetwork;
}
