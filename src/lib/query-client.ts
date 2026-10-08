import { QueryClient } from '@tanstack/react-query';

/**
 * `networkMode: 'always'`: React Query's default pauses requests while the phone reports
 * no network, so a screen kept its skeleton or spinner and never showed its error and
 * retry. Now the request runs and fails, and the error state shows. That mode turns
 * `refetchOnReconnect` off by default, so it is set again: a reconnect reloads the screen.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        networkMode: 'always',
        refetchOnReconnect: true,
      },
      mutations: { networkMode: 'always' },
    },
  });
}
