import ActionButton from '@/components/action-button';

const symbolClass = {
  empty: 'bg-marketplace-tint-soft text-marketplace-blue',
  error: 'bg-marketplace-danger-tint text-marketplace-danger',
};

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
    <section className="px-3 py-11 text-center" role="status">
      <span
        className={`m-auto grid size-16 place-items-center rounded-full text-[32px] ${symbolClass[type]}`}
        aria-hidden
      >
        {type === 'error' ? '!' : '○'}
      </span>
      <h2 className="mb-2.5 mt-5 text-[19px]">{title}</h2>
      <p className="mb-6 text-sm leading-normal text-marketplace-muted">{description}</p>
      {onAction && (
        <ActionButton type="button" onClick={onAction}>
          {actionLabel}
        </ActionButton>
      )}
    </section>
  );
}
