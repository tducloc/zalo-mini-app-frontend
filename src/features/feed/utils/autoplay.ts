/**
 * Which feed card plays its preview (plans/home-feed.md, Phase 4): one at a time, the one
 * nearest the middle of the screen, and never when the viewer asked for less motion or
 * less data.
 */

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A card must show this share of its height to be picked. */
const MIN_VISIBLE_SHARE = 0.6;

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
 * Whose turn it is to play: the card nearest the centre of the visible area among those
 * mostly in it and not yet `finished`, else null. Of two cards as near, the first (the
 * left one of a row) wins, and the other plays once it has finished. A card leaves
 * `finished` once no part of it is visible, so scrolling back plays it again.
 */
export function pickActiveCard(
  cards: { id: string; rect: Box }[],
  area: Box,
  finished: ReadonlySet<string>,
) {
  const middleY = centre(area.top, area.bottom);
  const middleX = centre(area.left, area.right);

  const stillFinished = new Set<string>();
  let best: { id: string; distance: number } | null = null;
  for (const { id, rect } of cards) {
    const height = rect.bottom - rect.top;
    const visible = Math.min(rect.bottom, area.bottom) - Math.max(rect.top, area.top);
    // A zero-size box is a card that is not laid out (hidden), not a visible one.
    if (height <= 0 || visible <= 0) {
      continue;
    }
    if (finished.has(id)) {
      stillFinished.add(id);
      continue;
    }
    if (visible < height * MIN_VISIBLE_SHARE) {
      continue;
    }

    const distance = Math.hypot(
      centre(rect.top, rect.bottom) - middleY,
      centre(rect.left, rect.right) - middleX,
    );
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
