import { ComponentProps, Fragment, useState } from 'react';
import { Sheet } from 'zmp-ui';

import { useOpenCount } from '@/hooks/use-open-count';
import { resolveSheetVisibility, settleSheetClose } from '@/utils/sheet-visibility';

type AppSheetProps = Omit<ComponentProps<typeof Sheet>, 'afterClose'>;

/**
 * zmp-ui Sheet that survives being reopened mid-close, and remounts its
 * content on every opening so forms start from fresh state.
 *
 * zmp-ui lets a tall sheet fill the screen and cannot scroll it (`overflow: hidden`,
 * `touch-action: none`), so on a small phone its last buttons were out of reach. The
 * sheet stops below the top, leaving backdrop to tap, and its body scrolls.
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
    <Sheet
      {...sheetProps}
      style={{ maxHeight: 'calc(100% - var(--zaui-safe-area-inset-top) - 48px)' }}
      visible={nextState.isShown}
      afterClose={handleAfterClose}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [touch-action:pan-y]">
        <Fragment key={openCount}>{children}</Fragment>
      </div>
    </Sheet>
  );
}
