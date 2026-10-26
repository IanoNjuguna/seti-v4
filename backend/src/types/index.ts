import type { TransactionType, TransactionStatus } from '@prisma/client';

export { TransactionType, TransactionStatus };

/** One asset's share of a balance, as the breakdown shows it. */
export interface AssetBalanceRow {
  /** The ledger label, e.g. `usdc.e`. */
  asset: string;
  /** The REGISTRY's spelling, e.g. `USDC.e`. Never the token contract's own claim. */
  symbol: string;
  /** The amount in the asset's own units, exactly as the ledger holds it. */
  amount: string;
}

/**
 * One asset's share of the home balance, with its own value.
 *
 * The home card shows rows, so a row has to be a figure a customer can add up: the
 * amount in the asset's own units AND what that amount is worth in the currency on
 * the card. Both are produced by `homeBalanceInFiat` from one read at one rate, and
 * the total above is the sum of these `value` strings rather than a parallel
 * computation — a breakdown whose rows add up to something other than the figure on
 * top contradicts itself, and the customer is right to trust the top of the screen.
 *
 * The currency is stated once, on the dashboard: repeating it per row would be N
 * chances for one row to disagree about what money is being measured in.
 */
export interface HomeAssetRow extends AssetBalanceRow {
  /** This row's own value, in the dashboard's currency, at the total's rate. */
  value: string;
}

export interface HomeDashboard {
  /**
   * The one money figure on the card: the sum of `assets[].value`. Not a second
   * total computed another way, which is how the card and its breakdown drift apart.
   */
  balance: string;
  currency: string;
  /**
   * What the balance is made of: one row per asset the chain lists, largest first.
   * `amount` is in the asset's OWN units; `value` is that amount in `currency`.
   */
  assets: HomeAssetRow[];
  monthToDateDelta: number;
  recentTransactions: RecentTransaction[];
}

/**
 * Somebody this account has already paid, as the send screen offers them (#99).
 *
 * Built by `services/recent-recipients.ts` from the same ledger rows Activity
 * reads. It carries the name the transfer was made AS (never an invented display
 * name), the handle to re-resolve when there is one, and the address behind it.
 */
export interface RecentRecipient {
  /**
   * What the row calls this person: a merchant's own signed business name, the
   * handle the customer resolved, or the address shortened for prose. Nothing else
   * is ever substituted, because a name is a claim about who gets the money.
   */
  name: string;
  /** The handle to re-resolve on tap, when this person has one. */
  handle: string | null;
  /** The address the money went to. The fallback target, and the identity key. */
  address: string;
  /** When they were last paid, as an ISO string. The list is ordered by it. */
  lastPaidAt: string;
}

export interface RecentTransaction {
  id: string;
  merchant: string;
  category: string;
  /**
   * Which way the money moved, from the ledger's own type.
   *
   * Sent to the client because the sign and the colour are derived from it, and a
   * row that has to infer direction from a display label gets it wrong — every
   * deposit rendered as an outflow before this existed.
   */
  direction: 'in' | 'out';
  amount: string;
  fiatAmount: string | null;
  fiatCurrency: string | null;
  date: Date;
  status: TransactionStatus;
  /**
   * The name the recipient was resolved from, when the customer had one.
   *
   * A label, not a decision: the receipt says who was paid. It exists because an
   * address cannot be resolved back to a name, so without it a failed row can
   * only offer a raw `0x…` the send flow cannot be pointed at (#119).
   */
  payeeHandle: string | null;
  /**
   * The on-chain hash, when the row has one. Carried so the Activity screen can
   * show the transfer the way an explorer does, and so a row with nothing on
   * chain is visibly journal-only rather than silently so.
   */
  txHash: string | null;
  /** The token this row moved — a label (`ousd`, `pathusd`, `usdt0`, `usdc.e`). */
  asset: string;
  /** The two ends of the transfer, each null when it is not a known address. */
  from: string | null;
  to: string | null;
}

export interface PayRequest {
  amount: string;
  asset: string;
  counterparty: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
