import { AxiosError } from 'axios';

export function getApiErrorStatus(error: unknown) {
  return error instanceof AxiosError ? error.response?.status : undefined;
}

/** `error.details` of the API's error envelope (api-spec, Conventions), unchecked. */
export function getApiErrorDetails(error: unknown): unknown {
  const body: unknown = error instanceof AxiosError ? error.response?.data : undefined;
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined;
  }
  const { error: envelope } = body;
  return typeof envelope === 'object' && envelope !== null && 'details' in envelope
    ? envelope.details
    : undefined;
}
