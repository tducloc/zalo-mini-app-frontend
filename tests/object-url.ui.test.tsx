import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useObjectUrl } from '@/features/listings/hooks/use-object-url';

describe('useObjectUrl', () => {
  // jsdom has no object URLs; each test brings its own.
  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('never hands back a revoked URL when the same blob is asked for again', () => {
    let created = 0;
    const revoked = new Set<string>();
    URL.createObjectURL = vi.fn(() => `blob:${++created}`);
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.add(url);
    });
    const file = new Blob(['x']);
    // URLs that were already revoked when a render returned them, even for one render.
    const shownRevoked: string[] = [];

    // A failed tile shows its file, Retry clears it, then the upload fails again.
    const { result, rerender, unmount } = renderHook(
      ({ blob }) => {
        const url = useObjectUrl(blob);
        if (url && revoked.has(url)) {
          shownRevoked.push(url);
        }
        return url;
      },
      { initialProps: { blob: file as Blob | null } },
    );
    rerender({ blob: null });
    rerender({ blob: file });

    expect(revoked.has('blob:1')).toBe(true);
    expect(shownRevoked).toEqual([]);
    expect(result.current).toBe('blob:2');
    unmount();
  });
});
