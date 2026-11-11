import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import { Text } from './Text';
import type { RowMarkProps } from './RowMark.types';

/**
 * The circle a list row opens with (#409, #533).
 *
 * ## What it carries, and why it is not always a letter
 *
 * A row with a name behind it draws the name's first letter, which is what a name reduces to at
 * 40px. A row with NO name must not: the title of such a row is a verb or an address, so a column of
 * initials became `S S R S` on a page of transfers and would become `0 0 0` on a page of unnamed
 * counterparties. Those rows wear a glyph saying what happened instead.
 *
 * ## Geometry, once
 *
 * `h-10 w-10` at `rounded-full`, which this system reserves for circles only (`design/revolut.md`,
 * `{rounded.full}`) and which is the size Activity's rows already reserved. It was written twice,
 * in `TransactionRowBody` and again for Home's merchant rows; it lives here now so a third surface
 * inherits the size rather than approximating it.
 *
 * ## Decorative
 *
 * `aria-hidden`, like every icon in this app: the name sits beside it as text, and that is what a
 * reader reads.
 */
export function RowMark({ icon, initial, tone = 'quiet', className }: RowMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
        tone === 'in' ? 'bg-accent-light-green/20' : 'bg-surface-soft',
        className
      )}
    >
      {icon ? (
        <Icon name={icon} className={cn('h-5 w-5', tone === 'in' ? 'text-ink-success' : 'text-ink')} />
      ) : (
        <Text variant="card-title">{initial ?? '?'}</Text>
      )}
    </span>
  );
}
