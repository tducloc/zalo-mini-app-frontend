import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ErrorBoundary from '@/components/feedback/error-boundary';
import { reportCrash } from '@/lib/crash-reporting';

vi.mock('@/lib/crash-reporting', () => ({ reportCrash: vi.fn() }));
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
    vi.mocked(reportCrash).mockClear();
  });

  it.each(['page', 'app'] as const)(
    'shows the Vietnamese error screen in the %s scope and reports the component stack',
    (scope) => {
      render(
        <ErrorBoundary scope={scope}>
          <Listing />
        </ErrorBoundary>,
      );

      expect(screen.getByRole('heading', { name: 'Đã có lỗi xảy ra' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
      expect(reportCrash).toHaveBeenCalledTimes(1);
      expect(reportCrash).toHaveBeenCalledWith({
        error: expect.objectContaining({ message: 'reel.video is null' }),
        source: 'react',
        componentStack: expect.stringContaining('Listing'),
      });
      // Not swallowed: React still logs it.
      expect(console.error).toHaveBeenCalled();
    },
  );

  it('renders the page again on retry, after running onRetry', async () => {
    const onRetry = vi.fn(() => {
      shouldThrow = false;
    });
    render(
      <ErrorBoundary scope="app" onRetry={onRetry}>
        <Listing />
      </ErrorBoundary>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
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
    expect(reportCrash).toHaveBeenCalledTimes(2);
  });
});
