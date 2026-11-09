'use client';

import { FeeQuote } from '@/components/money/FeeQuote';
import { TokenSelector } from '@/components/token-selector/TokenSelector';
import { PayAmountFigure, PayKeypad } from './PayAmount';
import type { MerchantAmountSectionProps } from './MerchantPayStep.types';

/** The field's id, shared by the figure, its keypad and its error line. */
export const PAY_AMOUNT_ID = 'pay-amount';

/**
 * What the customer is asked, in the order they answer it: the amount, then which balance pays it,
 * then the price of that answer (#228, #440).
 *
 * The figure leads, at display size, with a keypad under it — the shape every payment app in the
 * reference set uses, and the reason this step used to read as a form: a 48px labelled text box was
 * the biggest element on a surface whose subject is a number.
 *
 * The selector sits BETWEEN the amount and the fee line on purpose. It is the only thing on this
 * step that changes what the fee line says (the 2% is charged in the spent token, so a different
 * balance is a different quote), and reading the choice before the figures is what makes "the fee
 * changed" an explanation rather than a surprise. The figure never names a token: it is the
 * customer's currency, and that is the only thing a payment costs.
 *
 * The balance a keypad user needs is the token row's own (`Paying from OUSD · holds KES 12.00`),
 * which sits directly under the keys. It is deliberately NOT repeated under the figure: Satispay
 * has to print it there because its keypad screen has no token row, and two copies of one figure
 * within 300px is the duplication this system keeps removing.
 *
 * Everything is drawn from `payment`, which owns both the pin and the quote, so the three can never
 * be for different tokens.
 */
export function MerchantAmountSection({ payment, amountError }: MerchantAmountSectionProps) {
  /*
   * The currency is the QUOTE's, never assumed: `formatFiat` documents the rule ("the currency is
   * an argument, never assumed") and a KES-labelled figure that is really USD is the exact class of
   * error that rule exists for. So the unit arrives with the first preview, a few hundred
   * milliseconds after the first digit, and until then the balance line beneath the figure already
   * carries it in the customer's currency.
   */
  const currency = payment.preview?.fiatCurrency ?? '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <PayAmountFigure
          id={PAY_AMOUNT_ID}
          amount={payment.amount}
          currency={currency}
          error={amountError}
          disabled={payment.isBusy}
          onAmount={payment.setAmount}
        />

        <PayKeypad
          id={PAY_AMOUNT_ID}
          amount={payment.amount}
          disabled={payment.isBusy}
          onAmount={payment.setAmount}
        />
      </div>

      <TokenSelector model={payment.tokenSelector} onChoose={payment.setAsset} />

      <FeeQuote
        compact
        preview={payment.preview}
        loading={payment.previewLoading || payment.step === 'previewing'}
        tone="light"
        subject="payment"
      />
    </div>
  );
}
