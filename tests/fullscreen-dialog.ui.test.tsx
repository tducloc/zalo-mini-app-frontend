import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FullscreenDialog from '@/components/fullscreen-dialog';

describe('FullscreenDialog', () => {
  it('opens outside the page that scrolls, so the tab bar cannot cover it on iOS', () => {
    render(
      <div data-testid="page" style={{ overflow: 'auto' }}>
        <FullscreenDialog label="Ảnh 1" header="Ảnh 1" onClose={() => {}}>
          <img alt="Ảnh 1" />
        </FullscreenDialog>
      </div>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Ảnh 1' });
    expect(screen.getByTestId('page').contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
  });
});
