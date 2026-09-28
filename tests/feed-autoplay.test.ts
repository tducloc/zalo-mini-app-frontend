import { describe, expect, it } from 'vitest';

import { canAutoplay, pickActiveCard, visibleArea } from '@/features/feed/utils/autoplay';

// A 390×800 viewport, scrolled so its centre is at y = 400.
const viewport = { top: 0, bottom: 800, left: 0, right: 390 };

const card = (id: string, top: number, left = 0) => ({
  id,
  rect: { top, bottom: top + 250, left, right: left + 180 },
});

const noneFinished: ReadonlySet<string> = new Set();
const pick = (cards: ReturnType<typeof card>[], area: typeof viewport) =>
  pickActiveCard(cards, area, noneFinished).activeId;

describe('pickActiveCard', () => {
  it('picks the card whose centre is nearest the viewport centre', () => {
    const cards = [card('a', 20), card('b', 290), card('c', 560)];

    expect(pick(cards, viewport)).toBe('b');
  });

  it('in an even row of two, picks the left card', () => {
    // The real grid: both centres are 92 px from the middle of the screen.
    const cards = [card('left', 280, 13), card('right', 280, 197)];

    expect(pick(cards, viewport)).toBe('left');
  });

  it('skips a card that is not laid out (a zero-size box)', () => {
    const hidden = { id: 'hidden', rect: { top: 0, bottom: 0, left: 0, right: 0 } };

    expect(pick([hidden, card('b', 520)], viewport)).toBe('b');
  });

  it('in a row of two, picks the left card though the right one is nearer the centre', () => {
    // Same row, listed right first; a's centre is 95 px from the middle of the screen, b's 85 px.
    const cards = [card('b', 280, 190), card('a', 280, 10)];

    expect(pick(cards, viewport)).toBe('a');
  });

  it('skips a card that is mostly off screen', () => {
    // a shows only 50 of its 250 px; b is fully visible but further from the centre.
    const cards = [card('a', -200), card('b', 520)];

    expect(pick(cards, viewport)).toBe('b');
  });

  it('answers null when no card is on screen enough', () => {
    expect(pick([card('a', 900)], viewport)).toBeNull();
    expect(pick([], viewport)).toBeNull();
  });
});

describe('pickActiveCard turns', () => {
  // The real grid's even row: left and right are equally near the middle.
  const row = [card('left', 280, 13), card('right', 280, 197)];

  it('plays the left card, then the right one, then none', () => {
    const first = pickActiveCard(row, viewport, new Set());
    expect(first.activeId).toBe('left');

    const second = pickActiveCard(row, viewport, new Set([...first.finished, 'left']));
    expect(second.activeId).toBe('right');

    const third = pickActiveCard(row, viewport, new Set([...second.finished, 'right']));
    expect(third.activeId).toBeNull();
    expect(third.finished).toEqual(new Set(['left', 'right']));
  });

  it('plays a finished card again once it has left the screen and come back', () => {
    const scrolledAway = [card('left', 900, 13), card('right', 900, 197)];
    const away = pickActiveCard(scrolledAway, viewport, new Set(['left', 'right']));
    expect(away.finished).toEqual(new Set());

    expect(pickActiveCard(row, viewport, away.finished).activeId).toBe('left');
  });

  it('keeps a finished card finished while any part of it is still visible', () => {
    // Only 50 of its 250 px show: too little to play, enough to stay finished.
    const mostlyAway = [card('left', 750, 13)];
    const turn = pickActiveCard(mostlyAway, viewport, new Set(['left']));

    expect(turn.activeId).toBeNull();
    expect(turn.finished).toEqual(new Set(['left']));
    expect(pickActiveCard([card('left', 280, 13)], viewport, turn.finished).activeId).toBeNull();
  });

  it('a card further away that finished does not change which card plays', () => {
    const cards = [card('near', 290), card('far', 560)];
    const turn = pickActiveCard(cards, viewport, new Set(['far']));

    expect(turn.activeId).toBe('near');
    expect(turn.finished).toEqual(new Set(['far']));
  });
});

describe('pickActiveCard rows', () => {
  // The real square grid: 250 px cards, rows 268 px apart, columns at x = 13 and 197.
  const gridRow = (name: string, top: number, columns: ('left' | 'right')[] = ['left', 'right']) =>
    columns.map((column) => card(`${name}-${column}`, top, column === 'left' ? 13 : 197));
  const scrolled = (top: number) => [...gridRow('row1', top), ...gridRow('row2', top + 268)];

  // Row 1's centre is 125 px above the middle, row 2's 143 px below it, fully visible.
  const rowOneNearest = scrolled(150);
  // 40 px further down: row 2's centre is now 103 px from the middle, row 1's 165 px.
  const rowTwoNearest = scrolled(110);

  it('plays the middle row left, then right, then none though the next row is in full view', () => {
    const first = pickActiveCard(rowOneNearest, viewport, new Set());
    expect(first.activeId).toBe('row1-left');

    const second = pickActiveCard(
      rowOneNearest,
      viewport,
      new Set([...first.finished, 'row1-left']),
    );
    expect(second.activeId).toBe('row1-right');

    const third = pickActiveCard(
      rowOneNearest,
      viewport,
      new Set([...second.finished, 'row1-right']),
    );
    expect(third.activeId).toBeNull();
    expect(third.finished).toEqual(new Set(['row1-left', 'row1-right']));
  });

  it('switches to the next row once it is nearest, even while a card plays', () => {
    expect(pick(rowTwoNearest, viewport)).toBe('row2-left');
    // row1-left has finished and row1-right is playing: row 2's left card takes over.
    expect(pickActiveCard(rowTwoNearest, viewport, new Set(['row1-left'])).activeId).toBe(
      'row2-left',
    );
  });

  it('treats a row with one video card as a row', () => {
    const rows = (top: number) => [
      ...gridRow('row1', top, ['right']),
      ...gridRow('row2', top + 268, ['left']),
    ];

    expect(pick(rows(150), viewport)).toBe('row1-right');
    expect(pickActiveCard(rows(150), viewport, new Set(['row1-right'])).activeId).toBeNull();
    expect(pickActiveCard(rows(110), viewport, new Set(['row1-right'])).activeId).toBe('row2-left');
  });

  it('names the middle row the same through its turns and while it scrolls', () => {
    const first = pickActiveCard(rowOneNearest, viewport, new Set());
    const second = pickActiveCard(scrolled(170), viewport, new Set(['row1-left']));
    const done = pickActiveCard(rowOneNearest, viewport, new Set(['row1-left', 'row1-right']));
    const next = pickActiveCard(rowTwoNearest, viewport, new Set());

    expect(second.rowKey).toBe(first.rowKey);
    expect(done.rowKey).toBe(first.rowKey);
    expect(next.rowKey).not.toBe(first.rowKey);
    expect(pickActiveCard([], viewport, new Set()).rowKey).toBeNull();
  });

  it('keeps two cards whose tops differ by a pixel in one row, left first', () => {
    const row = [card('left', 281, 13), card('right', 280, 197)];

    expect(pick(row, viewport)).toBe('left');
    expect(pickActiveCard(row, viewport, new Set(['left'])).activeId).toBe('right');
    expect(pickActiveCard(row, viewport, new Set(['left', 'right'])).activeId).toBeNull();
  });
});

describe('visibleArea', () => {
  // A 390×844 page under a 155 px header, with 82 px kept for the tab bar.
  const page = { top: 0, bottom: 844, left: 0, right: 390 };
  const area = visibleArea(page, 155, 82);

  it('leaves out what the header and the tab bar cover', () => {
    expect(area).toEqual({ top: 155, bottom: 762, left: 0, right: 390 });
  });

  it('does not pick a card hidden under the header', () => {
    // 156 px of this card are inside the page, but only 1 px below the header.
    const underHeader = card('under-header', -94);

    expect(pick([underHeader], page)).toBe('under-header');
    expect(pick([underHeader], area)).toBeNull();
  });

  it('does not pick a card mostly under the tab bar', () => {
    expect(pick([card('under-tab-bar', 690)], area)).toBeNull();
  });
});

describe('canAutoplay', () => {
  const allowed = {
    isEnabled: true,
    wasRefused: false,
    prefersReducedMotion: false,
    saveData: false,
    effectiveType: '4g',
  };

  it('plays on a normal connection when the flag is on', () => {
    expect(canAutoplay(allowed)).toBe(true);
    // Browsers without the Network Information API.
    expect(canAutoplay({ ...allowed, saveData: undefined, effectiveType: undefined })).toBe(true);
  });

  it('respects the flag, a refusal, reduced motion, data saving and slow networks', () => {
    expect(canAutoplay({ ...allowed, isEnabled: false })).toBe(false);
    expect(canAutoplay({ ...allowed, wasRefused: true })).toBe(false);
    expect(canAutoplay({ ...allowed, prefersReducedMotion: true })).toBe(false);
    expect(canAutoplay({ ...allowed, saveData: true })).toBe(false);
    expect(canAutoplay({ ...allowed, effectiveType: '2g' })).toBe(false);
    expect(canAutoplay({ ...allowed, effectiveType: 'slow-2g' })).toBe(false);
  });
});
