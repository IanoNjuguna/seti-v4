export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'pill'
  /* `button-primary` from `design/revolut.md` — the white CTA on a dark band,
     which is the brand's loudest action and had no variant in this app. */
  | 'on-dark'
  /* `button-outline-dark` — its secondary, a hairline outline on the dark
     canvas. Both are only ever used on a dark band. */
  | 'outline-dark'
  /*
   * `button-soft` carrying the DESTRUCTIVE TEXT role: `surface-soft` fill, and a
   * label in the doc's inline error ink (`accent-deep-red`, via the `alert` text
   * role) rather than white on red. For an action that ends a session instead of
   * one that moves money: a filled red button on a settings list is the loudest
   * pixel on the page, and on Profile the loudest thing has to be the person.
   */
  | 'destructive-soft';

export type BadgeVariant = 'success' | 'neutral' | 'warning' | 'danger';

/**
 * The shape the UI renders, not the shape the API returns.
 *
 * `amount` is negative for money leaving the account, matching both the mobile
 * app and the way the ledger reads: a payment is an outflow.
 */
export interface Transaction {
  id: string;
  merchant: string;
  category: string;
  /** Signed by direction: negative when the money left the account. */
  amount: number;
  /** Which way it moved. The row's colour and sign both read from this. */
  direction: 'in' | 'out';
  /**
   * The currency `amount` is in.
   *
   * Rows written after the fiat figures existed carry the currency they were
   * recorded in. Older rows carry the stablecoin amount instead — USD-denominated,
   * because that is what the asset is — and labelling them with anything else is a
   * money claim that is off by the fx rate.
   */
  currency: string;
  date: Date;
  status: 'completed' | 'pending' | 'failed';
  /**
   * The chain's own detail for this row, when it has any.
   *
   * Optional: the home card's short list is the same type and simply does not
   * render these. The Activity screen shows them the way an explorer does, which
   * is the only place a customer can check a transfer after the fact.
   */
  txHash?: string | null;
  /** The token that moved — a label (`ousd`, `pathusd`, `usdt0`, `usdc.e`). */
  asset?: string;
  from?: string | null;
  to?: string | null;
  /** The name the payee was resolved from, when there is one. See `Transaction`. */
  payeeHandle?: string | null;
}
