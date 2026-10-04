import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ErrorBoundary from '@/components/feedback/error-boundary';

vi.mock('zmp-ui', () => ({
  Page: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

let shouldThrow = true;

function Listing() {
  if (shouldThrow) {
    throw new Error('reel.video is null');
  }
  return <p>Tin đăng</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React logs the caught error; keep it, but out of the test output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['page', 'app'] as const)(
    'shows the Vietnamese error screen in the %s scope',
    (scope) => {
      render(
        <ErrorBoundary scope={scope}>
          <Listing />
        </ErrorBoundary>,
      );

      expect(screen.getByRole('heading', { name: 'Đã có lỗi xảy ra' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
      // Not swallowed: React still logs it.
      expect(console.error).toHaveBeenCalled();
    },
  );

  it('renders the page again on retry once it no longer throws', async () => {
    render(
      <ErrorBoundary scope="page">
        <Listing />
      </ErrorBoundary>,
    );

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(screen.getByText('Tin đăng')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Đã có lỗi xảy ra' })).toBeNull();
  });

  it('shows the error screen again when the page still throws', async () => {
    render(
      <ErrorBoundary scope="page">
        <Listing />
      </ErrorBoundary>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(screen.getByRole('heading', { name: 'Đã có lỗi xảy ra' })).toBeTruthy();
  });

  it('reloads the app on retry in the app scope', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(
      <ErrorBoundary scope="app">
        <Listing />
      </ErrorBoundary>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
