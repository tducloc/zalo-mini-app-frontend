import type { InfiniteData, QueryClient, QueryFilters, QueryKey } from '@tanstack/react-query';

/**
 * TanStack refetches every loaded page of a stale infinite query, one after another, so the list
 * shifts under the viewer and one screen costs N requests. A list that is stale is loaded again
 * from its first page instead: the other pages drop, and they load on scroll with the new cursor.
 */
export function keepFirstPage<Page>(queryClient: QueryClient, filters: QueryFilters) {
  queryClient.setQueriesData<InfiniteData<Page, string | undefined>>(
    filters,
    (data) => data && { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
  );
}

/**
 * Loads page one of a cached infinite query again, when it is older than `staleTimeMs` or was
 * invalidated. The old first page stays until the new one arrives. Works on a query nothing
 * shows yet, so a page can reset its list before it mounts.
 * Returns whether it started a request.
 */
export function restartIfStale(queryClient: QueryClient, queryKey: QueryKey, staleTimeMs: number) {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true });
  if (!query?.state.data || query.state.fetchStatus !== 'idle') {
    return false;
  }
  if (!query.isStaleByTime(staleTimeMs)) {
    return false;
  }

  keepFirstPage(queryClient, { queryKey, exact: true });
  void queryClient.refetchQueries({ queryKey, exact: true });
  return true;
}
