export default function FeedbackState({
  type,
  title,
  description,
  onRetry,
  actionLabel = 'Thử lại',
}: {
  type: 'loading' | 'empty' | 'error' | 'success';
  title: string;
  description?: string;
  onRetry?: () => void;
  actionLabel?: string;
}) {
  return (
    <section className={`feedback-state feedback-${type}`} role="status">
      {type === 'loading' ? (
        <div className="demo-skeleton" />
      ) : (
        <span className="feedback-symbol" aria-hidden>
          {type === 'success' ? '✓' : type === 'error' ? '!' : '○'}
        </span>
      )}
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && (
        <button className="ui-button" onClick={onRetry}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}
