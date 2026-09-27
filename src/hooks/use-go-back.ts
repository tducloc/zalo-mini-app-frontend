import { useLocation, useNavigate } from 'zmp-ui';

/** The key of the first page the app opened on: there is no page before it. */
const FIRST_LOCATION_KEY = 'default';

/**
 * Back to the page before; opened straight from a link there is none, so to
 * `fallbackPath` instead, in place of this page.
 */
export function useGoBack(fallbackPath: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    if (location.key === FIRST_LOCATION_KEY) {
      navigate(fallbackPath, { replace: true });
      return;
    }
    navigate(-1);
  };
}
