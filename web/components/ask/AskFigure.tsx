'use client';

import { PayAmountFigure, PayKeypad } from '@/components/pay/PayAmount';
import type { AskFigureProps } from './ask.types';

/** Shared by the figure, its keypad and its error line. */
export const ASK_AMOUNT_ID = 'ask-amount';

/**
 * The amount, as the screen's subject (#465).
 *
 * The ask reuses `PayAmountFigure` and `PayKeypad` rather than growing a second keypad. Both routes
 * write through the same pure `applyKey`, so a figure the ask accepts is a figure the payment path
 * accepts, and neither can drift into a rule the server refuses. That is also why the shape rule
 * (`REQUEST_AMOUNT_PATTERN`: at most two decimals, at most nine integer digits, above zero) is quoted
 * in the service rather than restated here.
 *
 * The currency is `KES` because an ask may only BE in KES (`REQUEST_CURRENCIES`), not because it is
 * assumed: a figure labelled with a currency nobody validated is the error `formatFiat` exists to
 * prevent.
 */
export function AskFigure({ amount, disabled, onAmount, error }: AskFigureProps) {
  return (
    <div className="flex flex-col gap-3">
      <PayAmountFigure
        id={ASK_AMOUNT_ID}
        amount={amount}
        currency="KES"
        error={error ?? undefined}
        disabled={disabled}
        onAmount={onAmount}
      />

      <PayKeypad id={ASK_AMOUNT_ID} amount={amount} disabled={disabled} onAmount={onAmount} />
    </div>
  );
}
