import type { UseQueryResult } from '@tanstack/react-query';

/** The part of a list query's result a picker needs, with its loading and failed states. */
export type ListQuery<T> = Pick<UseQueryResult<T[]>, 'data' | 'isPending' | 'isError' | 'refetch'>;
