import { resolveApiErrorMessage } from '@/lib/api-error';
import type { ApiErrorOptions } from '@/lib/api-error';
import { useCallback } from 'react';
import { useSnackbar } from 'zmp-ui';

export type { ApiErrorOptions } from '@/lib/api-error';

export function useToast() {
  const { openSnackbar } = useSnackbar();

  const show = useCallback(
    (text: string, type: 'error' | 'success', duration: number) =>
      openSnackbar({
        text,
        type,
        icon: true,
        duration,
        position: 'bottom',
        zIndex: 1100,
      }),
    [openSnackbar],
  );

  const showError = useCallback(
    (message: string, duration = 4_500) => show(message, 'error', duration),
    [show],
  );

  const showSuccess = useCallback(
    (message: string, duration = 3_500) => show(message, 'success', duration),
    [show],
  );

  const showApiError = useCallback(
    (error: unknown, options: ApiErrorOptions) =>
      showError(resolveApiErrorMessage(error, options), options.duration),
    [showError],
  );

  return { showApiError, showError, showSuccess };
}
