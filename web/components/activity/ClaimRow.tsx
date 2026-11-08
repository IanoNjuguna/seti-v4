'use client';

import { Button, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { CLAIMS_COPY } from './ActivityClaims.constants';
import type { ClaimRowProps } from './ActivityClaims.types';

/**
 * One claim, in the ledger's own geometry (#465).
 *
 * The same 64px row, 40px circle and hairline as every transfer, built beside `TransactionRow`
 * rather than through it: a claim is not a transaction, and faking one to borrow a row would put a
 * pending payment in a ledger that never recorded it.
 *
 * The circle carries the clock, not an arrow: nothing has arrived yet, so the mark says *waiting*.
 * A lapsed or withdrawn claim drops the mark to the muted ink and wears its word under the amount,
 * which is the one column that never truncates — the same reason a failed transfer's word lives
 * there.
 *
 * CANCEL SITS UNDER THE NAME, NOT AT THE ROW'S EDGE. As a third column it squeezed the name and
 * the subtitle until "paid to @ian" was elided at 390px, and it left the amount starting at a
 * different x on rows that had one, which is the one thing a list of figures must not do. The
 * geometry is `TransactionRow`'s own action strip (`left-[4.5rem]`, `pb-12` reserved) because it
 * is the same kind of control: something that acts on the row it is under.
 */
export function ClaimRow({ claim, cancelling, onCancel }: ClaimRowProps) {
  const quiet = claim.stateWord !== CLAIMS_COPY.states.open;
  /** A withdrawn claim is not waiting for anything, so it does not wear the clock. */
  const mark = claim.state === 'cancelled' ? 'close' : 'clock';

  return (
    <div className="relative flex min-h-16 w-full items-stretch border-b border-hairline-light">
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 px-5 py-2.5',
          claim.cancellable && 'pb-12'
        )}
      >
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft"
        >
          <Icon name={mark} className={cn('h-5 w-5', quiet ? 'text-mute' : 'text-ink')} />
        </span>

        <span className="min-w-0 flex-1">
          <Text variant="card-title" as="span" className="block truncate">
            {claim.title}
          </Text>
          <Text variant="micro" as="span" color="secondary" className="block truncate">
            {claim.subtitle}
          </Text>
        </span>

        <span className="flex shrink-0 flex-col items-end">
          <Text variant="body-medium" tabular as="span" className="shrink-0 whitespace-nowrap">
            {claim.amount}
          </Text>
          <Text
            variant="micro"
            as="span"
            color={claim.stateWord === CLAIMS_COPY.states.open ? 'progress' : 'secondary'}
          >
            {claim.stateWord}
          </Text>
        </span>
      </div>

      {claim.cancellable ? (
        <div className="absolute bottom-2 left-[4.5rem]">
          <Button
            variant="pill"
            className="min-touch"
            disabled={cancelling}
            aria-label={CLAIMS_COPY.cancelLabel(claim.amount)}
            onClick={() => onCancel(claim.publicId)}
          >
            {cancelling ? CLAIMS_COPY.cancelling : CLAIMS_COPY.cancel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
