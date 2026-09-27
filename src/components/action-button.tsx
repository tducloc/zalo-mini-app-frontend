import type { ComponentProps } from 'react';

const baseClass =
  'block min-h-[46px] w-full rounded-[10px] border-0 px-4 py-3 font-semibold disabled:cursor-not-allowed';
const variantClass = {
  primary: 'bg-marketplace-blue text-white disabled:bg-[#b6c9e6]',
  // Keeps its colours while disabled.
  secondary: 'bg-marketplace-tint-soft text-marketplace-blue',
};

/** Full-width native button in the page's own font, for forms and feedback screens. */
export default function ActionButton({
  variant = 'primary',
  className = '',
  ...buttonProps
}: ComponentProps<'button'> & { variant?: keyof typeof variantClass }) {
  return (
    <button className={`${baseClass} ${variantClass[variant]} ${className}`} {...buttonProps} />
  );
}
