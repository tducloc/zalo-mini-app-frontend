import { resolveApiErrorMessage } from '@/utils/api-error';
import type { ApiErrorOptions } from '@/utils/api-error';
import { useCallback } from 'react';
import { useSnackbar } from 'zmp-ui';

export type { ApiErrorOptions } from '@/utils/api-error';

export function useToast() {
  const { openSnackbar } = useSnackbar();

  const show = useCallback(
    (text: string, type: 'error' | 'success' | 'info', duration: number) =>
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

  const showInfo = useCallback(
    (message: string, duration = 3_500) => show(message, 'info', duration),
    [show],
  );

  const showApiError = useCallback(
    (error: unknown, options: ApiErrorOptions) =>
      showError(resolveApiErrorMessage(error, options), options.duration),
    [showError],
  );

  return { showApiError, showError, showInfo, showSuccess };
}
