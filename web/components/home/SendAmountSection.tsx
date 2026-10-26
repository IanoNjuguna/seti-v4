'use client';

import { FeeQuote } from '@/components/money/FeeQuote';
import { TokenSelector } from '@/components/token-selector/TokenSelector';
import { SEND_COPY } from './SendPanel.constants';
import { SendField } from './SendField';
import type { SendAmountSectionProps } from './SendPanel.types';

/**
 * What the customer answers about the money, in the order they answer it: the
 * amount, then which balance pays it, then the price of that answer (#232).
 *
 * The selector sits BETWEEN the amount and the fee line on purpose, and it is the
 * same order the pay step draws — the selector is the only thing here that changes
 * what the fee line says, so reading the choice before the figures makes "the fee
 * changed" an explanation rather than a surprise.
 *
 * The amount field is above it and never names a token: the figure is the
 * customer's own currency, and that is the only thing a send costs them.
 *
 * The pin and the quote arrive together from `useSendPanel`, which owns both, so
 * the line, the fee and the transfer that gets signed can never be for different
 * tokens.
 */
export function SendAmountSection({
  amountLabel,
  amountFiat,
  amountError,
  preview,
  previewLoading,
  tokenSelector,
  busy,
  focusAmount,
  onAmountChange,
  onChooseAsset,
}: SendAmountSectionProps) {
  return (
    <div className="space-y-4">
      <SendField
        label={amountLabel}
        hint={SEND_COPY.amountHint}
        error={amountError}
        value={amountFiat}
        onChange={onAmountChange}
        inputMode="decimal"
        disabled={busy}
        autoFocus={focusAmount}
      />

      <TokenSelector model={tokenSelector} onChoose={onChooseAsset} />

      <FeeQuote preview={preview} loading={previewLoading} tone="dark" subject="send" />
    </div>
  );
}
