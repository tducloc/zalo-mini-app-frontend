export default function FeedbackState({
  type,
  title,
  description,
  onAction,
  actionLabel = 'Thử lại',
}: {
  type: 'loading' | 'empty' | 'error' | 'success';
  title: string;
  description?: string;
  /** Primary action (retry, clear filters…); labelled by `actionLabel`. */
  onAction?: () => void;
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
      {onAction && (
        <button className="ui-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}
