import { get } from './client';

/**
 * Money that arrived at an address the customer owns, with no charge behind it (#590).
 *
 * The endpoint is `GET /arrivals` and it is behind the session: an arrival belongs to the
 * account whose address received it, and the addresses are resolved from the session rather
 * than from the query. The row shape below is `ArrivalView` in
 * `backend/src/services/arrival-store.ts`, field for field — and `check:page-header` compares
 * the two, because a client type that drifts from the server's view renders `undefined` where
 * a figure should be, which looks like a bug in the money rather than a bug in the types.
 *
 * There is no `status`, no `matched` and no `chargeId` on a row, and the absence is the
 * feature: an arrival is a FACT about money plus an ABSENCE of attribution. A client cannot
 * render a state this row does not have.
 */

export interface ArrivalView {
  /** The transaction, for a customer who wants the chain. */
  txHash: string;
  /** The address that received the money. */
  recipient: string;
  /** Who sent it, as the chain recorded. The one handle on asking them what it was for. */
  from: string;
  /** The Seti ledger label of the token that moved (`ousd`). */
  asset: string;
  /** Decimal token units, exactly as the chain moved them. */
  amount: string;
  /** The block, when the log carried one. Null means unknown, never zero. */
  blockNumber: string | null;
  /** When the indexer first recorded this pass. */
  seenAt: string;
}

/** Totals per asset, as the server adds them up. `amount` is decimal token units. */
export interface ArrivalSummary {
  asset: string;
  count: number;
  amount: string;
}

export interface ArrivalsPage {
  arrivals: ArrivalView[];
  hasMore: boolean;
  summary: ArrivalSummary[];
  /** The product's own words for what an arrival is, so a surface does not invent a fifth. */
  copy: { label: string; headline: string; detail: string };
}

export function fetchArrivals(limit = 20): Promise<ArrivalsPage> {
  return get<ArrivalsPage>(`/arrivals?limit=${limit}`);
}
