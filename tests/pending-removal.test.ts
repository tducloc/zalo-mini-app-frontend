import { indexAfterRemoval } from '@/features/reels/utils/pending-removal';

describe('indexAfterRemoval', () => {
  const ids = ['a', 'b', 'gone', 'd'];

  it('moves the index left by the removed reels above it', () => {
    expect(indexAfterRemoval(ids, 3, new Set(['gone']))).toBe(2);
  });

  it('leaves an index that is still above the removed reel', () => {
    expect(indexAfterRemoval(ids, 1, new Set(['gone']))).toBe(1);
  });

  it('keeps the end of the list on the last remaining reel', () => {
    expect(indexAfterRemoval(ids, 4, new Set(['gone']))).toBe(3);
  });
});
