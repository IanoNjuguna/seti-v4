'use client';

import { Input } from '@/components/ui';
import { FeeQuote } from '@/components/money/FeeQuote';
import { TokenSelector } from '@/components/token-selector/TokenSelector';
import { PAY_STEP_COPY } from './Pay.constants';
import type { MerchantAmountSectionProps } from './MerchantPayStep.types';

/**
 * What the customer is asked, in the order they answer it: the amount, then which
 * balance pays it, then the price of that answer (#228).
 *
 * The selector sits BETWEEN the amount and the fee line on purpose. It is the only
 * thing on this step that changes what the fee line says — the 2% is charged in the
 * spent token, so a different balance is a different quote — and reading the choice
 * before the figures is what makes "the fee changed" an explanation rather than a
 * surprise. The amount field is above it and never names a token: the figure is the
 * customer's currency, and that is the only thing a payment costs.
 *
 * Everything is drawn from `payment`, which owns both the pin and the quote, so the
 * three can never be for different tokens.
 */
export function MerchantAmountSection({ payment, amountError }: MerchantAmountSectionProps) {
  return (
    <div className="flex flex-col gap-6">
      <Input
        label={PAY_STEP_COPY.amountLabel}
        inputMode="decimal"
        placeholder="0"
        value={payment.amount}
        onChange={(event) => payment.setAmount(event.target.value)}
        error={amountError}
        disabled={payment.isBusy}
      />

      <TokenSelector model={payment.tokenSelector} onChoose={payment.setAsset} />

      <FeeQuote
        preview={payment.preview}
        loading={payment.previewLoading || payment.step === 'previewing'}
        tone="light"
        subject="payment"
      />
    </div>
  );
}
