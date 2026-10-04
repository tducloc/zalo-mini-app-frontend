import type { CSSProperties } from 'react';

/** The grid's `gap-2.5`, between columns and between rows. */
export const CARD_GAP_PX = 10;

/**
 * A card is its column wide and this much taller: `listingCopyClass` (91px). The 1px border
 * above and below adds 2px, and takes 2px from the square image's width.
 */
const CARD_EXTRA_HEIGHT_PX = 91;

/** The first rows a phone shows; their images load eagerly for LCP. */
const ABOVE_FOLD_ROWS = 2;

/**
 * Cards per row from the feed's own width. Phones (up to ~430pt) keep 2. iPad mini and iPad
 * portrait (712–802px inside the 16px padding) get 3, iPad landscape and the 12.9" iPad
 * portrait (from 992px) get 4. Every column stays 190–330px wide.
 */
export function columnsForWidth(width: number) {
  if (width < 600) {
    return 2;
  }
  if (width < 960) {
    return 3;
  }
  return 4;
}

/** A card's height in a grid `width` wide with `columns` columns. */
export function cardHeight(width: number, columns: number) {
  const columnWidth = (width - CARD_GAP_PX * (columns - 1)) / columns;
  return columnWidth + CARD_EXTRA_HEIGHT_PX;
}

export const rowCount = (cards: number, columns: number) => Math.ceil(cards / columns);

/** The cards of one row, in feed order. */
export function cardsInRow<T>(cards: readonly T[], row: number, columns: number) {
  return cards.slice(row * columns, (row + 1) * columns);
}

export const aboveFoldCards = (columns: number) => columns * ABOVE_FOLD_ROWS;

/** Rows to keep mounted past each edge of the screen, for about `pixels` of scroll. */
export const overscanRows = (rowPitch: number, pixels: number) => Math.ceil(pixels / rowPitch);

export const gridColumnsStyle = (columns: number): CSSProperties => ({
  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
});
