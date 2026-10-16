/**
 * The receipt document, exactly as `GET /transactions/:id/receipt` returns it.
 *
 * Mirrors `backend/src/services/receipt.ts`. The backend builds it by reading the
 * chain receipt, so every figure here is what actually moved — nothing is echoed
 * back from the request that created the transfer.
 */
import type { Network } from '@/lib/network';

/** What a movement was, in the customer's terms. */
export type ReceiptLegRole = 'payment' | 'platform-fee' | 'gas';

export type ReceiptStatus = 'confirmed' | 'failed';

/** One token movement inside the transaction. */
export interface ReceiptLeg {
  /** 1-based, in the order the chain executed them. */
  index: number;
  role: ReceiptLegRole;
  /** The human name for the role, already in the customer's vocabulary. */
  label: string;
  asset: string;
  tokenAddress: string;
  from: string;
  to: string;
  /** Exact, in the token's own units. */
  amount: string;
  /** True when this leg is the customer's own money, either direction. */
  mine: boolean;
}

/** The gas line, itemised separately — as an explorer shows it. */
export interface ReceiptNetworkFee {
  asset: string;
  amount: string;
  fiatAmount: string | null;
}

/** What the customer's side of the transfer came to, gas excluded. */
export interface ReceiptTotal {
  asset: string;
  amount: string;
  fiatAmount: string;
  fiatCurrency: string | null;
}

/** What we recorded, at the rate in force when the row was written. */
export interface ReceiptLedger {
  direction: 'in' | 'out';
  fiatAmount: number;
  /** Nullable: a row written before the currency was stored has none. */
  fiatCurrency: string | null;
  platformFeeFiat: number | null;
  fxRate: number | null;
  fxRateSource: string | null;
  fxRateAsOf: string | null;
  title: string;
}

export interface ReceiptDocument {
  hash: string;
  /**
   * The network this receipt is from — `testnet` (Practice) or `mainnet` (Live),
   * with its product word in `networkLabel`.
   *
   * EVERY receipt names its network, so a shared link is never ambiguous about
   * which chain moved the money. The backend scopes the document by the row's own
   * network, so a practice receipt and a live one are told apart by construction.
   */
  network: Network;
  networkLabel: string;
  blockNumber: number;
  /** ISO 8601, from the block's own timestamp. */
  timestamp: string;
  status: ReceiptStatus;
  from: string;
  legs: ReceiptLeg[];
  networkFee: ReceiptNetworkFee;
  total: ReceiptTotal;
  ledger: ReceiptLedger;
  explorerUrl: string;
}
