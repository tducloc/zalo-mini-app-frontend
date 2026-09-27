/**
 * Which feed card plays its preview (plans/home-feed.md, Phase 4): one at a time, the one
 * nearest the middle of the screen, and never when the viewer asked for less motion or
 * less data.
 */

interface Box {
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

/** The card nearest the viewport's centre among those mostly on screen, else null. */
export function pickActiveCard(cards: { id: string; rect: Box }[], viewport: Box) {
  const middleY = centre(viewport.top, viewport.bottom);
  const middleX = centre(viewport.left, viewport.right);

  let best: { id: string; distance: number } | null = null;
  for (const { id, rect } of cards) {
    const visible = Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top);
    if (visible < (rect.bottom - rect.top) * MIN_VISIBLE_SHARE) {
      continue;
    }

    // Rows first; within a row of two, the card nearer the middle of the screen.
    const distance = Math.hypot(
      centre(rect.top, rect.bottom) - middleY,
      centre(rect.left, rect.right) - middleX,
    );
    if (!best || distance < best.distance) {
      best = { id, distance };
    }
  }
  return best?.id ?? null;
}

export function canAutoplay({
  isEnabled,
  prefersReducedMotion,
  saveData,
  effectiveType,
}: {
  isEnabled: boolean;
  prefersReducedMotion: boolean;
  /** From the Network Information API; undefined where the browser has none. */
  saveData: boolean | undefined;
  effectiveType: string | undefined;
}) {
  return (
    isEnabled &&
    !prefersReducedMotion &&
    !saveData &&
    !(effectiveType !== undefined && SLOW_NETWORKS.has(effectiveType))
  );
}
