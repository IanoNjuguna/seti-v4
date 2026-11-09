'use client';

import { PayAmountFigure } from '@/components/pay/PayAmount';
import type { AskFigureProps } from './ask.types';

/** Shared by the figure and its error line. */
export const ASK_AMOUNT_ID = 'ask-amount';

/**
 * The amount, as the screen's subject (#465), without the payment step's keypad (#513).
 *
 * The grid was designed for a till (#440): a figure at display size, tapped at a counter with the
 * thumb. An ask is a form, and the figure is already a real `<input inputMode="decimal">`, so on a
 * phone the grid sat under a field that opens the system keyboard anyway: two keyboards for one
 * field, half the page spent, and "Note or expiry" and "Create claim" pushed below the fold for an
 * amount that is usually three digits.
 *
 * The grid stays on the payment step, where the tap IS the interaction. Here the field is the whole
 * control, and it is unchanged: same size, same currency, same place.
 *
 * What the grid also did was hold the amount to a shape (`applyKey`: two decimals, nine digits, no
 * leading zero). A typed value never went through it, so that rule now lives with the submit
 * decision instead (`isValidAskAmount`), and the sentence is the one the server's refusal already
 * owns. The currency is `KES` because an ask may only BE in KES (`REQUEST_CURRENCIES`), not because
 * it is assumed: a figure labelled with a currency nobody validated is the error `formatFiat` exists
 * to prevent.
 */
export function AskFigure({ amount, disabled, onAmount, error }: AskFigureProps) {
  return (
    <PayAmountFigure
      id={ASK_AMOUNT_ID}
      amount={amount}
      currency="KES"
      error={error ?? undefined}
      disabled={disabled}
      onAmount={onAmount}
    />
  );
}
