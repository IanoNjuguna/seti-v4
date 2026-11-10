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

  /*
   * The withdrawal quote carries the exit's own network fee (#511).
   *
   * A Tempo transaction pays its gas before any call inside it runs, so a customer whose
   * balance is all in the vault has nothing to pay the exit with, and the send is refused
   * by the node rather than by anything we showed them. Two facts come off the quote: the
   * charge itself, and whether the balance outside the vault can cover it.
   */
  const withdrawing = !adding && quote !== null && 'canPayFee' in quote ? quote : null;
  const feeText = withdrawing ? formatFiat(Number(withdrawing.networkFeeFiat), currency) : '';
  /* Over-saved outranks both: that is a figure the customer can fix by typing less. */
  const feeShort = withdrawing !== null && !withdrawing.canPayFee && !overLimit;
  const vaultRefused =
    withdrawing !== null && !withdrawing.canWithdraw && !overLimit && !feeShort;

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

      {/* A BLOCKED exit, said as one. It used to live in the field's hint slot, in grey,
          under the figure the customer had just typed, which is the least alarming place on
          the sheet — and the button still looked tappable. Three facts and the way out. */}
      {feeShort ? (
        <Text variant="micro" color="alert" as="p" role="alert">
          {SAVE_COPY.withdrawFeeShort(
            feeText,
            formatFiat(Number(spendableFiat), currency)
          )}
        </Text>
      ) : null}

      {/* What the exit costs to sign, and the vault's own answer when it will not pay. Both
          sit under what will move, because both are facts about this amount, not about the
          page. */}
      {withdrawing && !overLimit && !feeShort && !vaultRefused ? (
        <Text variant="micro" color="secondary" as="p">
          {SAVE_COPY.withdrawFeeLine(feeText)}
        </Text>
      ) : null}

      {vaultRefused ? (
        <Text variant="micro" color="alert" as="p" role="alert">
          {SAVE_COPY.withdrawVaultRefused}
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
