import { describe, expect, it } from 'vitest';

import { thumbHashUrl } from '@/utils/thumbhash';

describe('thumbHashUrl', () => {
  it('turns a ThumbHash into a data URL and ignores a bad hash', () => {
    expect(thumbHashUrl('1QcSHQRnh493V4dIh4eXh1h4kJUI')).toMatch(/^data:image\/png;base64,/);
    expect(thumbHashUrl(null)).toBeNull();
    expect(thumbHashUrl('not-a-hash')).toBeNull();
  });
});
