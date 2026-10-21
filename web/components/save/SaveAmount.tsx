'use client';

import { formatFiat } from '@/lib/formatCurrency';
import { Button, Input, Text } from '@/components/ui';
import { SAVE_COPY } from './Save.constants';
import type { SaveAmountProps } from '@/hooks/useSave.types';

/**
 * The amount step: one field, one line about what happens, one button.
 *
 * The same decision as the convert page — one screen, the button is the
 * confirmation. No recipient, no fee to acknowledge, so a review step would only
 * repeat the figure back.
 *
 * It shows what will actually be saved (`swapOut`, from the server's quote, not from
 * the number typed) beside what is available. A customer moving money wants both
 * numbers in front of them, and neither is arithmetic this component does: the
 * quote's own `fiatAmount`/`amountIn` pair converts the swap leg back to currency.
 */
export function SaveAmount({
  currency,
  amount,
  quote,
  status,
  error,
  canSubmit,
  spendableFiat,
  onAmount,
  onSubmit,
  onCancel,
}: SaveAmountProps) {
  const ratio = quote && Number(quote.amountIn) > 0 ? Number(quote.fiatAmount) / Number(quote.amountIn) : 0;
  const willSave = quote ? formatFiat(Number(quote.swapOut) * ratio, currency) : null;
  const notEnough = quote !== null && !quote.hasEnoughBalance;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Text variant="card-title" as="h2">
        {SAVE_COPY.amountTitle}
      </Text>

      <Input
        id={SAVE_COPY.amountInputId}
        label={SAVE_COPY.amountLabel}
        value={amount}
        onChange={(event) => onAmount(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        placeholder={SAVE_COPY.amountPlaceholder}
        hint={
          notEnough
            ? `That is more than your ${formatFiat(Number(spendableFiat), currency)} available balance.`
            : SAVE_COPY.amountHint
        }
      />

      {willSave && !notEnough ? (
        <Text variant="micro" color="secondary" as="p">
          {willSave} — {SAVE_COPY.amountNote}
        </Text>
      ) : null}

      {error ? (
        <Text variant="micro" color="alert" as="p" role="alert">
          {error}
        </Text>
      ) : null}

      <Button type="submit" fullWidth loading={status === 'submitting'} disabled={!canSubmit}>
        {SAVE_COPY.amountButton}
      </Button>

      <Button type="button" variant="ghost" fullWidth onClick={onCancel}>
        {SAVE_COPY.cancel}
      </Button>
    </form>
  );
}
