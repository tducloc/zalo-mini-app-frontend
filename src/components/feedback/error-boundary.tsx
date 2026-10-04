import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Page } from 'zmp-ui';

import FeedbackState from '@/components/feedback/feedback-state';
import { pageClass } from '@/components/layout/styles';
import { reportCrash } from '@/lib/crash-reporting';

type Props = {
  children?: ReactNode;
  /** `page` sits inside a route, so the tab bar keeps working. `app` wraps everything. */
  scope: 'page' | 'app';
  /** Runs before the children render again, e.g. to reload the app. */
  onRetry?: () => void;
};

/** Shows a recoverable screen instead of a blank app when rendering throws. */
export default class ErrorBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportCrash({ error, source: 'react', componentStack: info.componentStack ?? undefined });
  }

  retry = () => {
    this.props.onRetry?.();
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const fallback = (
      <FeedbackState
        type="error"
        title="Đã có lỗi xảy ra"
        description="Màn hình này chưa hiển thị được. Bạn thử lại nhé."
        onAction={this.retry}
      />
    );

    return this.props.scope === 'page' ? (
      <Page className={pageClass}>
        <div className="pt-[var(--zaui-safe-area-inset-top)]">{fallback}</div>
      </Page>
    ) : (
      <div className="fixed inset-0 overflow-auto bg-white pt-[env(safe-area-inset-top)]">
        {fallback}
      </div>
    );
  }
}
