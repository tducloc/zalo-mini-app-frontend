export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A card must show this share of its height to be picked. */
const MIN_VISIBLE_SHARE = 0.6;

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

export function pickActiveCard(
  cards: { id: string; rect: Box }[],
  area: Box,
  finished: ReadonlySet<string>,
) {
  const middleY = centre(area.top, area.bottom);

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

  let rowY: number | null = null;
  for (const { centreY } of mostlyVisible) {
    if (rowY === null || Math.abs(centreY - middleY) < Math.abs(rowY - middleY)) {
      rowY = centreY;
    }
  }

  const row = mostlyVisible
    .filter(({ centreY }) => rowY !== null && Math.abs(centreY - rowY) <= ROW_TOLERANCE_PX)
    .sort((a, b) => a.rect.left - b.rect.left);
  return {
    activeId: row.find(({ id }) => !finished.has(id))?.id ?? null,
    rowKey: row[0]?.id ?? null,
    finished: stillFinished,
  };
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
