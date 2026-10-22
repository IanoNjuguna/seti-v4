import { Card } from '@/components/ui';
import { buildChargeUri } from '@/lib/charges/charge-uri';
import { chargeAmounts } from '@/lib/charges/charge-fee';
import { PayAmountPanel } from './PayAmountPanel';
import { PayCustodyNote } from './PayCustodyNote';
import { PayFeeBreakdown } from './PayFeeBreakdown';
import { PayQrPanel } from './PayQrPanel';
import { PayRecipient } from './PayRecipient';
import { PayStatusLine } from './PayStatusLine';
import { PAY_COPY, PAY_DIVIDER_CLASS, PAY_LINK_CLASS } from './PayPublic.constants';
import { feeNote, qrTitle, statusStep } from './pay-public.step';
import type { PayPublicViewProps } from './PayPublic.types';

/**
 * One payment request, drawn on a phone with no app and no JavaScript.
 *
 * Everything here arrives already decided: the charge, who is being paid, and what
 * state it is in. There is no `use*` hook and no `'use client'` in this module because
 * there is no client state to hold — the page's whole job is to print what the server
 * resolved, and a hook that existed for symmetry would be the only thing that could
 * make a figure disagree with itself between the server and the browser.
 *
 * The order is the argument: what state, how much, who, what it costs, how to pay,
 * and — outside the card, standing on the page — the sentence that says Seti never
 * touches the money.
 */
export function PayPublicView({ charge, payee, status }: PayPublicViewProps) {
  const amounts = chargeAmounts(charge.amount, charge.currency);
  const payable = status === 'pending';
  const mayChange = status === 'pending' || status === 'underpaid';
  const receiptPath = charge.receiptPath;
  const settled = status === 'paid' || status === 'overpaid';

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <PayStatusLine status={status} step={statusStep(status, charge, payee)} />
        <PayAmountPanel currency={charge.currency} amount={charge.amount} memo={charge.memo} />

        <div className={PAY_DIVIDER_CLASS} />
        <PayRecipient payee={payee} />

        <div className={PAY_DIVIDER_CLASS} />
        <PayFeeBreakdown currency={charge.currency} amounts={amounts} note={feeNote(charge, payee)} />

        {payable ? (
          <>
            <div className={PAY_DIVIDER_CLASS} />
            <PayQrPanel uri={buildChargeUri(charge.id)} title={qrTitle(charge, payee)} />
          </>
        ) : null}

        {settled && receiptPath !== null ? (
          <a href={receiptPath} className={PAY_LINK_CLASS}>
            {PAY_COPY.receipt}
          </a>
        ) : null}

        {mayChange ? (
          <a href={`/pay/${charge.id}`} className={PAY_LINK_CLASS}>
            {PAY_COPY.again}
          </a>
        ) : null}
      </Card>

      <PayCustodyNote />
    </div>
  );
}
