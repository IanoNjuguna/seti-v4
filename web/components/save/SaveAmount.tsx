'use client';

import { formatFiat } from '@/lib/formatCurrency';
import { Button, Input, Text } from '@/components/ui';
import { SAVE_COPY } from './Save.constants';
import type { SaveAmountProps } from '@/hooks/useSave.types';

/**
 * The amount step, in both directions.
 *
 * One field, one line about what happens, one button — the same decision as the
 * convert page, because there is no recipient and no fee to acknowledge, so a review
 * step would only repeat the figure back.
 *
 * It shows what will actually move, taken from the server's quote rather than from
 * the number typed: for a deposit that is `swapOut` (the vault's asset), for a
 * withdrawal it is what lands back in the spendable balance. A customer moving money
 * wants both numbers in front of them, and neither is arithmetic this component does.
 */
export function SaveAmount({
  mode,
  currency,
  amount,
  quote,
  status,
  error,
  canSubmit,
  spendableFiat,
  savedFiat,
  onAmount,
  onSubmit,
  onCancel,
}: SaveAmountProps) {
  const adding = mode === 'add';

  // Both numbers come from the server: a deposit moves what was typed, and a
  // withdrawal moves what the vault's own redeem quote pays out — which is not the
  // same figure, because the vault takes its fee on the way out.
  const willMove = !quote
    ? null
    : adding
      ? formatFiat(Number(quote.fiatAmount), currency)
      : formatFiat(Number('fiatOut' in quote ? quote.fiatOut : 0), currency);

  const overLimit = adding
    ? quote !== null && 'hasEnoughBalance' in quote && !quote.hasEnoughBalance
    : Number(amount) > Number(savedFiat);

  const hint = overLimit
    ? adding
      ? `That is more than your ${formatFiat(Number(spendableFiat), currency)} available balance.`
      : `That is more than the ${formatFiat(Number(savedFiat), currency)} you have saved.`
    : adding
      ? SAVE_COPY.amountHint
      : SAVE_COPY.withdrawHint;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Text variant="card-title" as="h2">
        {adding ? SAVE_COPY.amountTitle : SAVE_COPY.withdrawTitle}
      </Text>

      <Input
        id={adding ? SAVE_COPY.amountInputId : SAVE_COPY.withdrawInputId}
        label={adding ? SAVE_COPY.amountLabel : SAVE_COPY.withdrawLabel}
        value={amount}
        onChange={(event) => onAmount(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        placeholder={SAVE_COPY.amountPlaceholder}
        hint={hint}
      />

      {willMove && !overLimit ? (
        <Text variant="micro" color="secondary" as="p">
          {adding ? `${willMove} — ${SAVE_COPY.amountNote}` : `${willMove} — ${SAVE_COPY.withdrawNote}`}
        </Text>
      ) : null}

      {error ? (
        <Text variant="micro" color="alert" as="p" role="alert">
          {error}
        </Text>
      ) : null}

      <Button type="submit" fullWidth loading={status === 'submitting'} disabled={!canSubmit}>
        {adding ? SAVE_COPY.amountButton : SAVE_COPY.withdrawButton}
      </Button>

      <Button type="button" variant="ghost" fullWidth onClick={onCancel}>
        {SAVE_COPY.cancel}
      </Button>
    </form>
  );
}
