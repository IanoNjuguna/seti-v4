/**
 * What a quote needs to draw, structurally — the fields BOTH server previews
 * carry.
 *
 * `SendPreview` and `PaymentPreview` are separate types for separate endpoints,
 * and they agree on the four rows a customer reads: what the payee receives, the
 * platform fee, the network gas, and the total. Naming that agreement here means
 * one table draws both, and a field either endpoint stops sending is a type error
 * in the one place it is rendered.
 */
export interface FeeQuotePreview {
  fiatCurrency: string;
  /** The principal in the customer's currency — the amount they typed. */
  fiatAmount: string;
  feeFiat: string;
  /** The fee as a share of the principal, for the row's label. */
  feePercentOfPrincipal: string;
  networkFeeFiat: string;
  /** `estimate` wears a `≈`; anything else is the server's conservative reserve. */
  networkFeeSource: string;
  totalFiat: string;
  /** The rate these figures came from is a fallback or has outlived its window. */
  fxRateStale: boolean;
  hasEnoughBalance: boolean;
}

/**
 * Which canvas the table is drawn on: `light` for a white product surface
 * (`bg-surface-soft` well, ink/secondary text), `dark` for a table sitting on the
 * black canvas (`bg-canvas-dark`, `on-dark` text). Both send-flow branches price on
 * `canvas-light` now — the amount step included — so no caller passes `dark`; the
 * tone stays because the table is ONE component for either surface rather than two
 * that drift, not because a dark caller is live.
 */
export type FeeQuoteTone = 'light' | 'dark';

/** The noun in the short-balance sentence — the branch knows which it is. */
export type FeeQuoteSubject = 'send' | 'payment';

export interface FeeQuoteProps {
  preview: FeeQuotePreview | null;
  loading: boolean;
  tone: FeeQuoteTone;
  subject: FeeQuoteSubject;
}
