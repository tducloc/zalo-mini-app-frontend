import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useCategories } from '@/features/categories/api/get-categories';
import { useLocations } from '@/features/locations/api/get-locations';
import { apiClient } from '@/lib/api-client';

const TWO_HOURS_MS = 2 * 60 * 60_000;

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));

describe.each<{ name: string; useList: () => unknown; path: string }>([
  { name: 'categories', useList: () => useCategories(), path: '/categories' },
  { name: 'locations', useList: () => useLocations(), path: '/locations' },
])('$name list cache', ({ useList, path }) => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('is not fetched again when the screen remounts hours later', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const first = renderHook(useList, { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(0));
    first.unmount();

    await act(() => vi.advanceTimersByTimeAsync(TWO_HOURS_MS));
    renderHook(useList, { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith(path, expect.anything());
  });
});
