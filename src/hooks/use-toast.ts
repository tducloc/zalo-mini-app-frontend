import { useSnackbar } from 'zmp-ui';

type ToastType = 'error' | 'success' | 'info';

const ERROR_DURATION_MS = 4_500;
const NOTICE_DURATION_MS = 3_500;

export function useToast() {
  const { openSnackbar } = useSnackbar();

  const show = (text: string, type: ToastType, duration: number) =>
    openSnackbar({
      text,
      type,
      icon: true,
      duration,
      position: 'bottom',
      zIndex: 1100,
    });

  const showError = (message: string) => show(message, 'error', ERROR_DURATION_MS);
  const showSuccess = (message: string) => show(message, 'success', NOTICE_DURATION_MS);
  const showInfo = (message: string) => show(message, 'info', NOTICE_DURATION_MS);

  return { showError, showInfo, showSuccess };
}
