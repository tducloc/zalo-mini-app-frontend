import { useNavigate } from 'zmp-ui';

/** react-router numbers the app's history entries from 0, and a replace keeps the number. */
function historyIndex() {
  const state: unknown = window.history.state;
  const isNumbered =
    state !== null && typeof state === 'object' && 'idx' in state && typeof state.idx === 'number';
  return isNumbered ? state.idx : 0;
}

/**
 * Back to the page before. Opened straight from a link, or from a tab, which replaces the
 * page, there is none, so to `fallbackPath` instead, in place of this page.
 */
export function useGoBack(fallbackPath: string) {
  const navigate = useNavigate();

  return () => {
    if (historyIndex() === 0) {
      navigate(fallbackPath, { replace: true });
      return;
    }
    navigate(-1);
  };
}
