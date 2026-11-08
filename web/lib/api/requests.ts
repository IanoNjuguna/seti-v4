import { get, post } from './client';

/**
 * Asking a person for money (#465).
 *
 * The figures are decimal STRINGS in the customer's own currency, never numbers: they were validated
 * as a shape by `REQUEST_AMOUNT_PATTERN` on the server (at most two decimals, at most nine integer
 * digits, greater than zero), and parsing them into floats here would reintroduce exactly the
 * rounding that rule exists to prevent.
 *
 * `status` is DERIVED server-side, so `expired` is a fact about the clock rather than a column: an ask
 * that lapsed reads `expired` without anything having written it. Nothing on this side should decide
 * a request's state from `expiresAt` itself, or the two can disagree by a second.
 */
export interface RequestRefusal {
  error: string;
  code: string;
  /** Set when the refusal is "already settled", so a surface can point at the payment. */
  settledTransactionId?: string | null;
}

export type RequestState = 'open' | 'settled' | 'cancelled' | 'expired';

/** What creating an ask returns: the record and the opaque id the link carries. */
export interface CreatedAsk {
  id: string;
  publicId: string;
  destinationHandle: string;
  destinationAddress: string;
  amount: string;
  currency: string;
  memo: string;
  status: 'open';
}

/** One ask in the requester's own list. */
export interface AskSummary {
  publicId: string;
  destinationHandle: string;
  amount: string;
  currency: string;
  memo: string;
  status: RequestState;
  createdAt: string;
  /** Null when the ask never lapses. */
  expiresAt: string | null;
  settledTxHash: string | null;
}

/**
 * Create an ask.
 *
 * `expiresInDays` is days rather than an instant because an instant computed here is a date from THIS
 * machine's clock, and the server refuses a past one. `null` is the explicit "never lapses".
 */
export function createAsk(input: {
  destinationHandle: string;
  amount: string;
  currency?: string;
  memo?: string;
  expiresInDays?: number | null;
}): Promise<{ request: CreatedAsk }> {
  return post<{ request: CreatedAsk }>('/requests', input);
}

export function listAsks(userId: string): Promise<{ requests: AskSummary[] }> {
  return get<{ requests: AskSummary[] }>(`/users/${userId}/requests`);
}

export function cancelAsk(publicId: string): Promise<void> {
  return post<void>(`/requests/${publicId}/cancel`, {});
}

/** The link a payer opens. Signed out, because the payer may have no account at all. */
export function readAsk(publicId: string): Promise<{ request: CreatedAsk }> {
  return get<{ request: CreatedAsk }>(`/public/requests/${publicId}`);
}

/** `/app/pay?ask=<publicId>` — the link an ask is shared as. */
export function askLink(publicId: string, origin: string): string {
  return `${origin}/app/pay?ask=${encodeURIComponent(publicId)}`;
}
