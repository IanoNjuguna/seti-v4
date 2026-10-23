import { Card } from '@/components/ui';
import { chargeAmounts } from '@/lib/charges/charge-fee';
import { PayAmountPanel } from './PayAmountPanel';
import { PayCustodyNote } from './PayCustodyNote';
import { PayFeeBreakdown } from './PayFeeBreakdown';
import { PayPayerPanel } from './PayPayerPanel';
import { PayRecipient } from './PayRecipient';
import { PayStatusLine } from './PayStatusLine';
import { PAY_COPY, PAY_DIVIDER_CLASS, PAY_LINK_CLASS } from './PayPublic.constants';
import { payerHref } from './pay-public.payer';
import { feeNote, statusStep } from './pay-public.step';
import type { PayPublicViewProps } from './PayPublic.types';

/**
 * One payment request, drawn on a phone with no app and no JavaScript.
 *
 * Everything here arrives already decided: the charge, who is being paid, what state
 * it is in, and which of the payer's three situations they declared (`payer`, #153).
 * There is no `use*` hook and no `'use client'` in this module because there is no
 * client state to hold — the page's whole job is to print what the server resolved,
 * and a hook that existed for symmetry would be the only thing that could make a
 * figure disagree with itself between the server and the browser.
 *
 * The order is the argument: what state, how much, who, what it costs, how to pay it
 * (which is where a payer with no wallet is told so, before any prompt), and — outside
 * the card, standing on the page — the sentence that says Seti never touches the money.
 */
export function PayPublicView({ charge, payee, status, payer }: PayPublicViewProps) {
  const amounts = chargeAmounts(charge.amount, charge.currency);
  const payable = status === 'pending';
  const mayChange = status === 'pending' || status === 'underpaid';
  const receiptPath = charge.receiptPath;
  const settled = status === 'paid' || status === 'overpaid';

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <PayStatusLine status={status} step={statusStep(status, charge, payee, payer)} />
        <PayAmountPanel currency={charge.currency} amount={charge.amount} memo={charge.memo} />

        <div className={PAY_DIVIDER_CLASS} />
        <PayRecipient payee={payee} />

        <div className={PAY_DIVIDER_CLASS} />
        <PayFeeBreakdown currency={charge.currency} amounts={amounts} note={feeNote(charge, payee)} />

        {payable ? (
          <>
            <div className={PAY_DIVIDER_CLASS} />
            <PayPayerPanel charge={charge} payee={payee} payer={payer} />
          </>
        ) : null}

        {settled && receiptPath !== null ? (
          <a href={receiptPath} className={PAY_LINK_CLASS}>
            {PAY_COPY.receipt}
          </a>
        ) : null}

        {/* A re-read keeps the payer's OWN declaration: a tap on "Check again" from the
            no-wallet state must not turn the page back into a payment prompt. */}
        {mayChange ? (
          <a href={payerHref(charge.id, payer)} className={PAY_LINK_CLASS}>
            {PAY_COPY.again}
          </a>
        ) : null}
      </Card>

      <PayCustodyNote />
    </div>
  );
}
