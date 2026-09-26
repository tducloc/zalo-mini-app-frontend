export default function FeedbackState({
  type,
  title,
  description,
  onAction,
  actionLabel = 'Thử lại',
}: {
  type: 'empty' | 'error';
  title: string;
  description?: string;
  /** Primary action (retry, clear filters…); labelled by `actionLabel`. */
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <section className={`feedback-state feedback-${type}`} role="status">
      <span className="feedback-symbol" aria-hidden>
        {type === 'error' ? '!' : '○'}
      </span>
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
