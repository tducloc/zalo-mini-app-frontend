import type { ChangeEvent } from 'react';

/** The dashed "+" tile that opens the picker, as the grid's last cell. */
export default function MediaAddTile({
  label,
  accept,
  isMultiple,
  onPick,
}: {
  label: string;
  accept: string;
  isMultiple: boolean;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <li className="aspect-square">
      <label className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-marketplace-tint-strong bg-marketplace-tint text-marketplace-blue">
        <span className="text-2xl leading-none">+</span>
        <small className="text-micro">{label}</small>
        <input
          type="file"
          accept={accept}
          multiple={isMultiple}
          aria-label={label}
          onChange={onPick}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </li>
  );
}
