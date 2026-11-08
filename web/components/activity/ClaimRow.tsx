'use client';

import { Button, Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { CLAIM_STATE_LABEL, CLAIMS_COPY, isOpen } from './Claims.constants';
import type { AskSummary } from '@/lib/api/requests';

export interface ClaimRowProps {
  claim: AskSummary;
  withdrawing: boolean;
  onWithdraw: (publicId: string) => void;
}

/**
 * One claim, as a row (#465).
 *
 * The figure leads because it is what the claim is about, the state is a word beside it because a
 * colour alone would not survive a screen reader or a photograph, and the withdrawal is a control only
 * while the claim is still open.
 *
 * It is deliberately NOT a ledger row: nothing has moved. `ClaimRow` sits in its own band above the
 * history so a customer cannot read a claim as money that left or arrived.
 */
export function ClaimRow({ claim, withdrawing, onWithdraw }: ClaimRowProps) {
  const label = CLAIM_STATE_LABEL[claim.status];
  const open = isOpen(claim.status);

  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-hairline-light py-3 last:border-b-0">
      <span className="flex min-w-0 flex-col gap-1">
        <Text variant="body-medium" as="span" tabular>
          {formatFiat(Number(claim.amount), claim.currency)}
        </Text>
        <Text variant="micro" as="span" color="secondary" className="truncate">
          {claim.memo || CLAIMS_COPY.to(claim.destinationHandle)}
        </Text>
        <Text variant="micro" as="span" color={open ? 'secondary' : 'primary'}>
          {label}
        </Text>
      </span>

      {open ? (
        <Button
          variant="secondary"
          disabled={withdrawing}
          onClick={() => onWithdraw(claim.publicId)}
        >
          {withdrawing ? CLAIMS_COPY.withdrawing : CLAIMS_COPY.withdraw}
        </Button>
      ) : null}
    </li>
  );
}
