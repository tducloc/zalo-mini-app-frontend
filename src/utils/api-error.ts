import { AxiosError } from 'axios';

export type ApiErrorOptions = {
  fallbackMessage: string;
  messages?: Partial<Record<number, string>>;
  duration?: number;
};

export function getApiErrorStatus(error: unknown) {
  return error instanceof AxiosError ? error.response?.status : undefined;
}

export function resolveApiErrorMessage(error: unknown, options: ApiErrorOptions) {
  const status = getApiErrorStatus(error);
  return (status ? options.messages?.[status] : undefined) ?? options.fallbackMessage;
}
