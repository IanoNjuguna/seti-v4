'use client';

import { Input, StateMessage } from '@/components/ui';
import { FeeQuote } from '@/components/money/FeeQuote';
import { MerchantCard } from './MerchantCard';
import { MerchantPaySuccess } from './MerchantPaySuccess';
import { PayActions } from './PayActions';
import { PAY_STEP_COPY } from './Pay.constants';
import { merchantPayStepFlags } from './merchant-pay-step';
import type { MerchantPayStepProps } from './MerchantPayStep.types';

/**
 * The merchant payment itself: the card, the itemised quote, the Pay action and
 * the success screen.
 *
 * Note the amount input's currency label: it is the customer's own currency, and
 * the quote beside it is the server's answer. Nothing here prices anything.
 *
 * It is reached only through `MerchantPayStep`, which is where the session is
 * checked; every call below signs real money, so there is deliberately no path
 * into this file that skips that check.
 */
export function MerchantPayStepBody({ payment, onCancel }: MerchantPayStepProps) {
  if (payment.step === 'done') {
    return <MerchantPaySuccess payment={payment} />;
  }

  const { canPay, amountError, blockError } = merchantPayStepFlags(payment);

  return (
    <div className="flex flex-col gap-6">
      {/* ONE rendering of the merchant, resolving or resolved. The card carries
          the skeleton in the shape the identity will land in, so the step has one
          wait instead of two, and nothing draws a surface around a sentence. */}
      <MerchantCard merchant={payment.merchant} resolving={payment.step === 'resolving'} />

      <Input
        label={PAY_STEP_COPY.amountLabel}
        inputMode="decimal"
        placeholder="0"
        value={payment.amount}
        onChange={(event) => payment.setAmount(event.target.value)}
        error={amountError}
        disabled={payment.isBusy}
      />

      <FeeQuote
        preview={payment.preview}
        loading={payment.previewLoading || payment.step === 'previewing'}
        tone="light"
        subject="payment"
      />

      {blockError ? (
        <StateMessage
          variant="failure"
          title={PAY_STEP_COPY.errorTitle}
          body={payment.txHash ? blockError : `${blockError} ${PAY_STEP_COPY.nothingMoved}`}
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
