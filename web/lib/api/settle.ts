import { get } from './client';

/**
 * The settlement plan: what the backend wants moved into OUSD, priced, and what it
 * left alone.
 *
 * A READ. The customer's own wallet signs each item; the backend never holds a key
 * that can move funds (see `backend/src/services/settlement.ts`). That is why this
 * is a GET and why the response carries a floor to sign rather than a hash.
 */

export interface SettlePlanItem {
  assetIn: string;
  assetOut: string;
  /** What would be spent, in `assetIn` units. */
  amountIn: string;
  /** What the book says arrives, in `assetOut` units. */
  amountOut: string;
  /** The floor to sign. Under-delivery is refused by the chain, not tolerated here. */
  minAmountOut: string;
  /** Spread against par, in basis points. Already compared with the server's cap. */
  spreadBps: number;
}

export interface SettleSkip {
  asset: string;
  balance: string;
  /** `already-target` | `below-threshold` | `no-market` | `spread-too-wide` | `not-listed` */
  reason: string;
}

export interface SettlePlan {
  network: string;
  target: string;
  /** The frozen rate the plan priced in. Hand it back with the hash to record. */
  quoteId: string | null;
  items: SettlePlanItem[];
  skipped: SettleSkip[];
}

export async function fetchSettlePlan(): Promise<SettlePlan> {
  const { plan } = await get<{ plan: SettlePlan }>('/transactions/settle/plan');
  return plan;
}
