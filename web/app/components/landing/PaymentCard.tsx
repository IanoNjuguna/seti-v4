import { cn } from '@/lib/cn';
import { formatFiat } from '@/lib/formatCurrency';
import type { PaymentCardProps } from './PaymentStack.types';

/**
 * One row of the stack, drawn in the app's own row language: a round initial,
 * the name, the line that explains who paid whom, and the figure set tabular on
 * the right so three cards line up as a column of numbers.
 *
 * Colour comes from the direction and it is never the only signal — the sign
 * (`+`/`-`) is in the figure itself, which is what a ledger does and what a
 * deuteranope reads. Money in is `accent-light-green` (the system's reserved
 * positive); a routine send stays in `ink`, because a payment going out is not
 * an event worth a colour.
 *
 * The avatar is `rounded-full` and stays that way: circles are circles —
 * `rounded-full` is for avatars, status dots and round icon buttons, and nothing
 * else on this surface. The card itself is `rounded-md` (12px), the control and
 * surface radius, on a white `surface-card` with a `hairline-light` edge and no
 * shadow (this system has no shadow language).
 *
 * The name column is the ONLY thing allowed to shrink and it truncates; the
 * figure is `shrink-0` and `whitespace-nowrap`, so a long merchant name
 * ellipsises rather than the amount — the amount is the row's reason to exist.
 */
export function PaymentCard({ payment, className }: PaymentCardProps) {
  const { name, amount, currency, detail, time } = payment;
  const isOutflow = amount < 0;

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-md border border-hairline-light bg-surface-card p-4',
        className
      )}
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft font-brand text-heading-sm font-medium text-ink"
      >
        {name.replace(/^@/, '').charAt(0)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-md-bold font-semibold text-ink">{name}</span>
        <span className="mt-0.5 block truncate text-caption text-mute">{detail}</span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={cn(
            'block whitespace-nowrap font-tabular text-body-md-bold font-semibold',
            isOutflow ? 'text-ink' : 'text-accent-light-green'
          )}
        >
          {isOutflow ? '-' : '+'}
          {formatFiat(Math.abs(amount), currency)}
        </span>
        <span className="mt-0.5 block text-caption text-mute">{time}</span>
      </span>
    </div>
  );
}
