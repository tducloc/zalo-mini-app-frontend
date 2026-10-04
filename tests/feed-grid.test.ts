import { describe, expect, it } from 'vitest';

import {
  aboveFoldCards,
  cardHeight,
  cardsInRow,
  columnsForWidth,
  overscanRows,
  rowCount,
} from '@/features/feed/utils/feed-grid';

// The feed is the screen minus 16px on each side.
const feedWidth = (screen: number) => screen - 32;

describe('columnsForWidth', () => {
  it.each([
    ['iPhone SE', 375, 2],
    ['iPhone Pro Max', 430, 2],
    ['iPad mini portrait', 744, 3],
    ['iPad portrait', 820, 3],
    ['iPad Pro 11" portrait', 834, 3],
    ['iPad Pro 12.9" portrait', 1024, 4],
    ['iPad mini landscape', 1133, 4],
    ['iPad landscape', 1180, 4],
    ['iPad Pro 12.9" landscape', 1366, 4],
  ])('%s (%ipt) shows %i cards a row', (_, screen, columns) => {
    expect(columnsForWidth(feedWidth(screen))).toBe(columns);
  });

  it('switches at 600 and 960px of feed', () => {
    expect(columnsForWidth(599)).toBe(2);
    expect(columnsForWidth(600)).toBe(3);
    expect(columnsForWidth(959)).toBe(3);
    expect(columnsForWidth(960)).toBe(4);
  });
});

describe('cardHeight', () => {
  it('is the column width and the 91px under the image', () => {
    // 412pt Pixel 7: 380px feed, two 185px columns, measured card 276px in the app.
    expect(cardHeight(380, 2)).toBe(276);
    // 375pt: 343px feed, 166.5px columns.
    expect(cardHeight(343, 2)).toBe(257.5);
    // 1180pt iPad landscape: 1148px feed, four 279.5px columns.
    expect(cardHeight(1148, 4)).toBe(370.5);
  });
});

describe('row mapping', () => {
  const cards = Array.from({ length: 7 }, (_, index) => `card-${index}`);

  it('counts a part-filled last row', () => {
    expect(rowCount(7, 2)).toBe(4);
    expect(rowCount(8, 2)).toBe(4);
    expect(rowCount(7, 3)).toBe(3);
    expect(rowCount(0, 3)).toBe(0);
  });

  it('puts cards in feed order, left to right then down', () => {
    expect(cardsInRow(cards, 0, 3)).toEqual(['card-0', 'card-1', 'card-2']);
    expect(cardsInRow(cards, 1, 3)).toEqual(['card-3', 'card-4', 'card-5']);
    expect(cardsInRow(cards, 2, 3)).toEqual(['card-6']);
    expect(cardsInRow(cards, 3, 2)).toEqual(['card-6']);
  });

  it('every card lands in exactly one row', () => {
    for (const columns of [2, 3, 4]) {
      const rows = Array.from({ length: rowCount(cards.length, columns) }, (_, row) =>
        cardsInRow(cards, row, columns),
      );
      expect(rows.flat()).toEqual(cards);
    }
  });

  it('loads the first two rows eagerly', () => {
    expect(aboveFoldCards(2)).toBe(4);
    expect(aboveFoldCards(4)).toBe(8);
  });

  it('keeps enough rows past the screen for the pixels asked', () => {
    expect(overscanRows(286, 1000)).toBe(4);
    expect(overscanRows(380.5, 1000)).toBe(3);
  });
});
