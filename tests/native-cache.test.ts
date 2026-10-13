import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, string>());
const nativeStorage = vi.hoisted(() => ({
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    store.delete(key);
  }),
}));

vi.mock('zmp-sdk', () => ({ nativeStorage }));

import { readNativeCache, removeNativeCache, writeNativeCache } from '@/lib/native-cache';

const KEY = 'test-key';
const HOUR_MS = 60 * 60 * 1000;

beforeEach(() => {
  store.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('native cache', () => {
  it('returns what was written', () => {
    writeNativeCache(KEY, { a: [1, 2] }, 1);

    expect(readNativeCache(KEY, { version: 1, maxAgeMs: HOUR_MS })).toEqual({ a: [1, 2] });
  });

  it('drops a value saved under another version', () => {
    writeNativeCache(KEY, 'old', 1);

    expect(readNativeCache(KEY, { version: 2 })).toBeUndefined();
    expect(store.has(KEY)).toBe(false);
  });

  it('drops an expired value and keeps one at the limit', () => {
    writeNativeCache(KEY, 'x', 1);
    vi.advanceTimersByTime(HOUR_MS);
    expect(readNativeCache(KEY, { version: 1, maxAgeMs: HOUR_MS })).toBe('x');

    vi.advanceTimersByTime(1);
    expect(readNativeCache(KEY, { version: 1, maxAgeMs: HOUR_MS })).toBeUndefined();
    expect(store.has(KEY)).toBe(false);
  });

  it('never expires a value when no maximum age is given', () => {
    writeNativeCache(KEY, 'x', 1);
    vi.advanceTimersByTime(1000 * HOUR_MS);

    expect(readNativeCache(KEY, { version: 1 })).toBe('x');
  });

  it.each(['{not json', '"text"', '{"v":1,"savedAt":"now","data":1}', '{"v":1,"savedAt":1}'])(
    'reads corrupt value %s as empty and removes it',
    (raw) => {
      store.set(KEY, raw);

      expect(readNativeCache(KEY, { version: 1 })).toBeUndefined();
      expect(store.has(KEY)).toBe(false);
    },
  );

  it('removes a saved value', () => {
    writeNativeCache(KEY, 'x', 1);
    removeNativeCache(KEY);

    expect(store.has(KEY)).toBe(false);
  });

  it('does not throw when nativeStorage throws', () => {
    const failure = new Error('-1404');
    nativeStorage.getItem.mockImplementation(() => {
      throw failure;
    });
    nativeStorage.setItem.mockImplementation(() => {
      throw failure;
    });
    nativeStorage.removeItem.mockImplementation(() => {
      throw failure;
    });

    expect(readNativeCache(KEY, { version: 1 })).toBeUndefined();
    expect(() => writeNativeCache(KEY, 'x', 1)).not.toThrow();
    expect(() => removeNativeCache(KEY)).not.toThrow();
  });
});
