/**
 * What the Polymarket card reads, as the API spells it (#599).
 *
 * The union is the product. `linked: false` is "we have nowhere to look yet" and gets a
 * link prompt; a linked wallet with an empty `positions` array is "we looked and there is
 * nothing", which is a different sentence. Collapsing them would tell a customer they hold
 * nothing when in fact they never told us where to look.
 *
 * Every money figure arrives already converted, at the `fxRate` carried on the same body,
 * so a row and the headline cannot disagree. Nothing here is recomputed on the client.
 */
export interface PolymarketPosition {
  title: string;
  slug: string | null;
  outcome: string | null;
  redeemable: boolean;
  endDate: string | null;
  size: number;
  averagePrice: number;
  currentPrice: number;
  currentValueFiat: number;
  unrealizedPnlFiat: number;
  totalPnlFiat: number;
  percentPnl: number;
}

export interface PolymarketLinkedView {
  linked: true;
  address: string;
  fiatCurrency: string;
  /** Units of `fiatCurrency` per USD. The rate every figure above was built at. */
  fxRate: string;
  fxSource: string;
  fxStale: boolean;
  totalFiat: number;
  totalUsd: number;
  redeemableCount: number;
  positions: PolymarketPosition[];
}

export interface PolymarketUnlinkedView {
  linked: false;
  fiatCurrency: string;
}

export type PolymarketView = PolymarketLinkedView | PolymarketUnlinkedView;
