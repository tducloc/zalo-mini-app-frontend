import { ErrorBoundary as SentryErrorBoundary } from '@sentry/react';
import type { ReactNode } from 'react';
import { Page } from 'zmp-ui';

import FeedbackState from '@/components/feedback/feedback-state';
import { pageClass } from '@/components/layout/styles';

type Props = {
  children?: ReactNode;
  /** `page` sits inside a route, so the tab bar keeps working. `app` wraps everything. */
  scope: 'page' | 'app';
};

/** Shows a recoverable screen instead of a blank app when rendering throws, and reports it. */
export default function ErrorBoundary({ children, scope }: Props) {
  return (
    <SentryErrorBoundary
      fallback={({ resetError }) => {
        const fallback = (
          <FeedbackState
            type="error"
            title="Đã có lỗi xảy ra"
            description="Màn hình này chưa hiển thị được. Bạn thử lại nhé."
            // The app scope has nothing around it to recover with, so it starts over.
            onAction={scope === 'app' ? () => window.location.reload() : resetError}
          />
        );

        return scope === 'page' ? (
          <Page className={pageClass}>
            <div className="pt-[var(--zaui-safe-area-inset-top)]">{fallback}</div>
          </Page>
        ) : (
          <div className="fixed inset-0 overflow-auto bg-white pt-[env(safe-area-inset-top)]">
            {fallback}
          </div>
        );
      }}
    >
      {children}
    </SentryErrorBoundary>
  );
}
