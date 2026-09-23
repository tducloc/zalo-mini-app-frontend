import { useState } from 'react';

/**
 * Increments each time `visible` turns true. Use it as a `key` to restart a
 * sheet's form state on every opening, instead of zmp-ui's `unmountOnClose`,
 * which unmounts in afterClose and leaves a sheet reopened during the close
 * animation stuck closed while `visible` is true.
 */
export function useOpenCount(visible: boolean) {
  const [openCount, setOpenCount] = useState(0);
  const [wasVisible, setWasVisible] = useState(visible);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setOpenCount((count) => count + 1);
    }
  }

  return openCount;
}
