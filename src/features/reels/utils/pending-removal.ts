/**
 * A reel hidden or sold while it is on screen stays in the list until the viewer
 * leaves it. Removing it immediately shifts every later index, and the open
 * detail follows that index onto a different listing.
 */

const pending = new Set<string>();
let isMounted = false;

export function setReelsMounted(mounted: boolean) {
  isMounted = mounted;
}

export function areReelsMounted() {
  return isMounted;
}

export function markReelForRemoval(id: string) {
  pending.add(id);
}

export function pendingReelIds() {
  return [...pending];
}

export function forgetReelRemovals(ids: readonly string[]) {
  for (const id of ids) pending.delete(id);
}

/** How far the active index moves left after those ids leave the list. */
export function indexAfterRemoval(
  ids: readonly string[],
  activeIndex: number,
  removed: ReadonlySet<string>,
) {
  let removedBefore = 0;
  const end = Math.min(activeIndex, ids.length);
  for (let index = 0; index < end; index += 1) {
    if (removed.has(ids[index])) removedBefore += 1;
  }
  const remaining = ids.length - ids.filter((id) => removed.has(id)).length;
  return Math.max(0, Math.min(activeIndex - removedBefore, remaining));
}
