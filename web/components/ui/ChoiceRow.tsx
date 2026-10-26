import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import { Text } from './Text';
import { CHOICE_ROW_CLASS } from './ChoiceRow.constants';
import type { ChoiceRowProps } from './ChoiceRow.types';

/**
 * One option in a list of options: a label, a reason under it, and the whole row as the
 * tap target.
 *
 * The tap target and the explanation are the same object on purpose. A label with a
 * button underneath it makes the customer work out which one they are pressing, and on a
 * phone the smaller of the two wins.
 *
 * The label is left-aligned even when the row is full width. A centred two-line option
 * reads as a call to action, and a page with two of them reads as a page that cannot
 * decide which one it wants.
 *
 * This exists because `Button` cannot hold this content: its variants are a fixed 48px
 * with centred text, so a label plus a detail line overflows the box and the next row's
 * border lands on top of the words. Do not put multi-line content in `Button`.
 */
export function ChoiceRow({
  label,
  detail,
  onSelect,
  disabled,
  selected = false,
  showChevron = false,
  className,
}: ChoiceRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(CHOICE_ROW_CLASS, selected && 'border-ink bg-surface-soft', className)}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Text as="span" variant="button">
          {label}
        </Text>
        {detail ? (
          <Text as="span" variant="micro" color="secondary">
            {detail}
          </Text>
        ) : null}
      </span>

      {selected ? (
        <span aria-hidden className="flex shrink-0 items-center self-center">
          <Icon name="check" className="h-4 w-4 text-ink" />
        </span>
      ) : showChevron ? (
        <span aria-hidden className="flex shrink-0 items-center self-center">
          <Icon name="chevronRight" className="h-4 w-4 text-mute" />
        </span>
      ) : null}
    </button>
  );
}
