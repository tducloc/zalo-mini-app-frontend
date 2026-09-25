import { describe, expect, it } from 'vitest';

import workerSource from '@/features/media/image/worker.ts?worker-source';

// The worker starts from this string through a Blob URL, as a classic script.
describe('image worker source', () => {
  it('is one self-contained, minified script', () => {
    expect(workerSource).not.toMatch(/^\s*(import|export)\s/m);
    expect(workerSource).toContain('convertToBlob');
    // Only types come from the page's side, so none of its code is bundled in.
    expect(workerSource).not.toContain('createObjectURL');
    expect(workerSource.length).toBeLessThan(3000);
  });
});
