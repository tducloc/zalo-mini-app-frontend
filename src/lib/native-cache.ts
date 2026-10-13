import { nativeStorage } from 'zmp-sdk';

import { warnInDev } from '@/utils/dev-log';

interface CacheEnvelope<T> {
  v: number;
  savedAt: number;
  data: T;
}

interface ReadOptions {
  version: number;
  maxAgeMs?: number;
}

export interface CacheHit<T> {
  data: T;
  savedAt: number;
}

function isEnvelope(value: unknown): value is CacheEnvelope<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { v, savedAt } = value as Partial<CacheEnvelope<unknown>>;
  return typeof v === 'number' && typeof savedAt === 'number' && 'data' in value;
}

function isExpired(envelope: CacheEnvelope<unknown>, maxAgeMs: number | undefined) {
  return maxAgeMs !== undefined && Date.now() - envelope.savedAt > maxAgeMs;
}

export function removeNativeCache(key: string) {
  try {
    nativeStorage.removeItem(key);
  } catch (error) {
    warnInDev('native-cache', 'remove failed', error);
  }
}

/**
 * The saved value, or undefined. A value that is missing, corrupt, from another
 * version or past `maxAgeMs` is removed. Never throws: a failing store reads as empty.
 */
export function readNativeCache<T>(
  key: string,
  { version, maxAgeMs }: ReadOptions,
): CacheHit<T> | undefined {
  let raw: string | null;
  try {
    raw = nativeStorage.getItem(key);
  } catch (error) {
    warnInDev('native-cache', 'read failed', error);
    return undefined;
  }

  if (!raw) {
    return undefined;
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    envelope = undefined;
  }

  if (!isEnvelope(envelope) || envelope.v !== version || isExpired(envelope, maxAgeMs)) {
    removeNativeCache(key);
    return undefined;
  }

  return { data: envelope.data as T, savedAt: envelope.savedAt };
}

/** Overwrites the value under `key`. Never throws. */
export function writeNativeCache<T>(key: string, data: T, version: number) {
  const envelope: CacheEnvelope<T> = { v: version, savedAt: Date.now(), data };
  try {
    nativeStorage.setItem(key, JSON.stringify(envelope));
  } catch (error) {
    warnInDev('native-cache', 'write failed', error);
  }
}
