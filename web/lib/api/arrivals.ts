import { get } from './client';

/**
 * Money that arrived at an address the customer owns, with no charge behind it (#590).
 *
 * The endpoint is `GET /arrivals` and it is behind the session: an arrival belongs to the
 * account whose address received it, and the addresses are resolved from the session rather
 * than from the query. The row shape here is the server's own view (`toArrivalView`), which is
 * what the notifications list prints, so a row cannot say one thing on the list and another in
 * the place it came from.
 */

export interface ArrivalView {
  id: string;
  /** The amount in the asset it arrived in, as a decimal string. */
  amount: string;
  asset: string;
  /** The address that received it, shortened server-side for display. */
  recipient: string;
  /** The transaction hash, for a reader who wants the chain. */
  txHash: string | null;
  /** ISO instant the arrival was indexed. */
  createdAt: string;
  /** True when the money has been matched to a charge or a person. */
  matched: boolean;
}

export interface ArrivalsPage {
  arrivals: ArrivalView[];
  hasMore: boolean;
  summary: { count: number; total: string; asset: string }[];
  copy: { title: string; body: string };
}

export function fetchArrivals(limit = 20): Promise<ArrivalsPage> {
  return get<ArrivalsPage>(`/arrivals?limit=${limit}`);
}
