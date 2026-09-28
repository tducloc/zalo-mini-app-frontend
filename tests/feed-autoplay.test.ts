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

  it('in a row of two, picks the one nearer the horizontal centre', () => {
    // Same row; a's centre is 95 px from the middle of the screen, b's 85 px.
    const cards = [card('a', 280, 10), card('b', 280, 190)];

    expect(pick(cards, viewport)).toBe('b');
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
