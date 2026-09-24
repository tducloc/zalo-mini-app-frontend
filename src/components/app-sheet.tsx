import { ComponentProps, Fragment, useState } from 'react';
import { Sheet } from 'zmp-ui';

import { useOpenCount } from '@/hooks/use-open-count';
import { resolveSheetVisibility, settleSheetClose } from '@/utils/sheet-visibility';

type AppSheetProps = Omit<ComponentProps<typeof Sheet>, 'afterClose'>;

/**
 * zmp-ui Sheet that survives being reopened mid-close, and remounts its
 * content on every opening so forms start from fresh state.
 */
export default function AppSheet({ visible = false, children, ...sheetProps }: AppSheetProps) {
  const [state, setState] = useState({ isShown: visible, isClosing: false });

  const nextState = resolveSheetVisibility(state, visible);
  if (nextState !== state) {
    setState(nextState);
  }

  const openCount = useOpenCount(nextState.isShown);

  const handleAfterClose = () => setState((current) => settleSheetClose(current, visible));

  return (
    <Sheet {...sheetProps} visible={nextState.isShown} afterClose={handleAfterClose}>
      <Fragment key={openCount}>{children}</Fragment>
    </Sheet>
  );
}
