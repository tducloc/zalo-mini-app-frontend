import { describe, expect, it } from 'vitest';

import { listingCopyClass, listingGridClass } from '@/features/feed/constants/styles';
import {
  aboveFoldCards,
  CARD_EXTRA_HEIGHT_PX,
  CARD_GAP_PX,
  cardHeight,
  cardsInRow,
  columnsForWidth,
  overscanRows,
  rowCount,
} from '@/features/feed/utils/feed-grid';

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
  it.each([
    ['Pixel 7, as measured in the app', 412, 2, 276],
    ['iPhone SE', 375, 2, 257.5],
    ['iPad landscape', 1180, 4, 370.5],
  ])('%s (%ipt): %i columns, %fpx cards', (_, screen, columns, height) => {
    expect(cardHeight(feedWidth(screen), columns)).toBe(height);
  });

  it('uses the gap and copy height the card styles render', () => {
    expect(listingGridClass).toContain(`gap-${CARD_GAP_PX / 4}`);
    expect(listingCopyClass).toContain(`h-[${CARD_EXTRA_HEIGHT_PX}px]`);
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
