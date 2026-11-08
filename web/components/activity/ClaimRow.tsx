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
 * pending payment in the ledger that the ledger never recorded.
 *
 * The circle carries the clock, not an arrow: nothing has arrived yet, so the mark says *waiting*.
 * A lapsed or withdrawn claim drops the mark to the muted ink and wears its word under the amount,
 * which is the one column that never truncates — the same reason a failed transfer's word lives
 * there.
 *
 * Cancel is a ghost control and exists only while the claim can still be paid. It names the amount
 * in its accessible label, because a list of identical "Cancel" buttons is not a list a screen
 * reader can use.
 */
export function ClaimRow({ claim, cancelling, onCancel }: ClaimRowProps) {
  const quiet = claim.stateWord !== CLAIMS_COPY.states.open;

  return (
    <div className="flex min-h-16 w-full items-center gap-3 border-b border-hairline-light px-5 py-2.5">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft"
      >
        <Icon name="clock" className={cn('h-5 w-5', quiet ? 'text-mute' : 'text-ink')} />
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

      {claim.cancellable ? (
        <Button
          variant="ghost"
          className="min-touch shrink-0"
          disabled={cancelling}
          aria-label={CLAIMS_COPY.cancelLabel(claim.amount)}
          onClick={() => onCancel(claim.publicId)}
        >
          {cancelling ? CLAIMS_COPY.cancelling : CLAIMS_COPY.cancel}
        </Button>
      ) : null}
    </div>
  );
}
