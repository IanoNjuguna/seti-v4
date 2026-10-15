'use client';

import { Input, StateMessage } from '@/components/ui';
import { MerchantCard } from './MerchantCard';
import { PayActions } from './PayActions';
import { PayPreviewSummary } from './PayPreviewSummary';
import { PaySuccess } from './PaySuccess';
import type { UsePayMerchantReturn } from '@/hooks/usePayMerchant.types';

export interface MerchantPayStepProps {
  /** The payment machinery for the resolved merchant, owned by the caller. */
  payment: UsePayMerchantReturn;
  /** Cancel: reset the payment, and put the customer back at the step before. */
  onCancel: () => void;
}

/**
 * The amount-and-pay step for a MERCHANT — the second half of the send flow when
 * the resolved name turns out to be a business.
 *
 * It is the old pay screen's body, extracted rather than rewritten: same merchant
 * card, same itemised quote, same "Payment not sent / Nothing left your wallet"
 * routing, same success screen. What left is the frame — the page heading and the
 * entry field — because the send flow owns those now (it asked the flow's
 * question and its own `h1` stands above this step).
 *
 * The success screen is INSIDE the step, because a payment that landed is the same
 * step completed — the flow does not need to know that the merchant branch has a
 * third state of its own.
 *
 * Note the amount input's currency label: it is the customer's own currency, and
 * the quote beside it is the server's answer. Nothing here prices anything.
 */
export function MerchantPayStep({ payment, onCancel }: MerchantPayStepProps) {
  const amountIsValid = payment.amount !== '' && Number(payment.amount) > 0;
  const canPay =
    amountIsValid &&
    !payment.isBusy &&
    !payment.previewLoading &&
    payment.preview?.hasEnoughBalance !== false;

  // Only a balance problem is the customer's entry, so only that one belongs on
  // the field; a wallet/config/rejection failure is not an amount problem.
  const amountError =
    payment.errorKind === 'insufficient-funds' ? (payment.error ?? undefined) : undefined;
  const blockError = payment.error && !amountError ? payment.error : null;

  if (payment.step === 'done') {
    const preview = payment.preview;
    const merchant = payment.merchant;

    return (
      <PaySuccess
        txHash={payment.txHash}
        onDone={() => payment.reset()}
        summary={
          preview && merchant
            ? {
                merchant: merchant.name,
                amountFiat: preview.fiatAmount,
                feeFiat: preview.feeFiat,
                networkFeeFiat: preview.networkFeeFiat,
                totalFiat: preview.totalFiat,
                fiatCurrency: preview.fiatCurrency,
                gasEstimated: preview.networkFeeSource === 'estimate',
              }
            : null
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {payment.merchant ? (
        <MerchantCard merchant={payment.merchant} resolving={payment.step === 'resolving'} />
      ) : (
        <StateMessage
          variant="neutral"
          title="Finding the merchant"
          body="One moment — their profile decides how this payment is priced."
        />
      )}

      <Input
        label="Amount"
        inputMode="decimal"
        placeholder="0"
        value={payment.amount}
        onChange={(event) => payment.setAmount(event.target.value)}
        error={amountError}
        disabled={payment.isBusy}
      />

      <PayPreviewSummary
        preview={payment.preview}
        loading={payment.previewLoading || payment.step === 'previewing'}
      />

      {blockError ? (
        <StateMessage
          variant="failure"
          title="Payment not sent"
          /* The question a failed payment has to answer is "did my money move?".
             No broadcast means no: say so. Once a transaction hash exists the
             money DID move and only the recording failed, so nothing is added —
             the code's own sentence already sends the customer to their wallet. */
          body={payment.txHash ? blockError : `${blockError} Nothing left your wallet.`}
        />
      ) : null}

      <PayActions
        step={payment.step}
        canPay={canPay}
        onPay={() => void payment.pay()}
        onCancel={onCancel}
      />
    </div>
  );
}
