import type { ConvertQuote } from '@/lib/api/convert';

/**
 * Whether a swap from one balance is offered at all.
 *
 * Three states, and the third is the one the product is about: a pair whose book
 * cannot fill the balance has NO control, rather than a disabled one. A disabled
 * button is a promise of a feature that never arrives; an absent control is the book
 * answering honestly.
 */
export type ConvertQuoteStatus =
  /** The question is being asked. Nothing is drawn yet, because the answer decides. */
  | 'loading'
  /** The book answered: there is something to offer. */
  | 'ready'
  /** No block, no balance, or no answer at all. Draw nothing. */
  | 'refused';

export interface ConvertQuoteState {
  status: ConvertQuoteStatus;
  /** The quote to offer, when there is one. */
  quote: ConvertQuote | null;
  /**
   * The server's refusal code, when one arrived (`convert-no-liquidity`,
   * `convert-insufficient-balance`, …).
   *
   * Carried rather than rendered: a row that offers no control says nothing, and the
   * sentence for a code lives in `refusal.constants.ts` for the surfaces that DO
   * show one. It is here so a caller can branch on the cause without parsing copy.
   */
  code: string | null;
}

export interface UseConvertQuoteInput {
  /** The balance's asset. */
  assetIn: string;
  /** What it converts into. One target per row, so no pair picker is offered. */
  assetOut: string;
  /**
   * The balance, as the row prints it.
   *
   * Only a TRIGGER: it is never sent, because the amount is `max` and the server
   * computes what that is from the chain. It is here so a balance that changed — after
   * a swap, or a deposit landing — re-asks instead of offering last minute's figure.
   */
  balance: string;
  /**
   * The figure to price, in `assetIn` units, or `'max'` for the whole spendable balance.
   *
   * Defaults to `'max'` so a balance row keeps asking the question it always asked. A
   * surface where the customer types an amount passes that amount: it is the SERVER's
   * to convert into a floor, a payout and a fee, and the answer is a quote for the
   * figure on screen rather than a figure this client worked out.
   */
  amount?: string;
}
