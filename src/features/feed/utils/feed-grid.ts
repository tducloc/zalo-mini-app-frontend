import type { CSSProperties } from 'react';

export const CARD_GAP_PX = 10;

// The card's 1px border adds 2px to its height and takes 2px from the square image, so they cancel.
export const CARD_EXTRA_HEIGHT_PX = 91;

// The images in these rows load eagerly for LCP.
const ABOVE_FOLD_ROWS = 2;

export function columnsForWidth(width: number) {
  if (width < 600) {
    return 2;
  }
  if (width < 960) {
    return 3;
  }
  return 4;
}

export function cardHeight(width: number, columns: number) {
  const columnWidth = (width - CARD_GAP_PX * (columns - 1)) / columns;
  return columnWidth + CARD_EXTRA_HEIGHT_PX;
}

export const rowCount = (cards: number, columns: number) => Math.ceil(cards / columns);

export function cardsInRow<T>(cards: readonly T[], row: number, columns: number) {
  return cards.slice(row * columns, (row + 1) * columns);
}

export const aboveFoldCards = (columns: number) => columns * ABOVE_FOLD_ROWS;

export const overscanRows = (rowPitch: number, pixels: number) => Math.ceil(pixels / rowPitch);

export const gridColumnsStyle = (columns: number): CSSProperties => ({
  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
});
