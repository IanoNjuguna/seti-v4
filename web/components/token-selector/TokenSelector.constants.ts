/**
 * The selector's words.
 *
 * The one place in the app that names a token is a balance row, and that is the
 * point of this control (#228): the person says which of their balances pays, so
 * the name has to be visible where the choice is made. Everywhere else — the
 * amount field, the fee line, the receipt — still says money.
 *
 * No em dash, no exclamation, no question mark: the same voice every other
 * sentence in a money flow uses.
 */
export const TOKEN_SELECTOR_COPY = {
  /** Prefix for a row the price has already named. */
  payingFrom: 'Paying from',
  /** What the row's figure is, beside the symbol. */
  holds: 'holds',
  /** The trigger's label while nothing has been priced yet. */
  choose: 'Which balance pays',
  /** The trigger's detail: how many balances there are to choose between. */
  balanceCount: (count: number) => (count === 1 ? '1 balance' : `${count} balances`),
  /** The way out of #223's refusal: the token that CAN pay. */
  offer: (symbol: string) => `Pay from ${symbol}`,
  /** A failed balance read is stated, not hidden: the payment still prices. */
  unavailable: 'The balances could not be loaded, so this payment is priced from your money as a whole.',
} as const;
