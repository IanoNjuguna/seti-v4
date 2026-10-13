/**
 * Stateless signed price quotes: the FX rate a customer was SHOWN, frozen at
 * quote time and carried to the record path.
 *
 * WHY THIS EXISTS
 *
 * A fiat figure is derived from an FX rate. Before this, the preview priced with
 * the live rate and `recordPayment`/`recordSend` re-read the live rate when they
 * wrote, so across a cache refresh the number the customer was shown and the
 * number written to the ledger could differ. "In practice tiny" is not a promise.
 * The product decision is that the rate shown IS the rate recorded, by
 * construction: the preview signs the rate it used, and a record path may only
 * write fiat figures from a rate it can prove came from that signed quote.
 *
 * WHY STATELESS
 *
 * No database table, no in-memory store, no migration. A signed token survives a
 * restart and works across instances, which a process-local map does not. It is a
 * RATE PROMISE, not a nonce: reading it does not consume it, so a retry after a
 * network failure succeeds within its TTL. The amount is still verified
 * independently against the on-chain receipt — this freezes the RATE, never the
 * money, and must not weaken that reconciliation.
 */
import { env } from '../config/env.js';
// The signing scheme and the secret are shared with the receipt link — see
// `lib/signed-token.ts`. One HMAC implementation, one `QUOTE_SIGNING_SECRET`.
import { sign, signaturesMatch } from '../lib/signed-token.js';

/**
 * Typed reasons a quote cannot be used.
 *
 * These reach the client as the backend's machine-readable refusal code, so the
 * app can render a specific state (re-quote, sign in again) instead of
 * "something went wrong".
 */
export type QuoteFailureCode =
  /** No token was presented at all. */
  | 'quote-missing'
  /** The token is malformed or its signature does not verify. */
  | 'quote-invalid'
  /** The token is genuine but has aged out of its TTL. */
  | 'quote-expired'
  /** The token is genuine but was issued to a different account. */
  | 'quote-not-yours';

export class QuoteError extends Error {
  readonly code: QuoteFailureCode;

  constructor(code: QuoteFailureCode, message: string) {
    super(message);
    this.name = 'QuoteError';
    this.code = code;
  }
}

export interface QuoteInput {
  /** The account the quote belongs to. A quote is not transferable between users. */
  userId: string;
  fiatCurrency: string;
  /** Units of `fiatCurrency` per 1 USD. This is the frozen rate. */
  fiatPerUsd: number;
  source: string;
  asOf: Date;
  /** Overrides `QUOTE_TTL_SECONDS`. A ~0/negative value mints an already-expired quote. */
  ttlSeconds?: number;
}

/** The frozen rate a record path must write, recovered from a verified quote. */
export interface FrozenRate {
  fiatCurrency: string;
  fiatPerUsd: number;
  source: string;
  asOf: Date;
}

/**
 * The signed payload.
 *
 * Short keys keep the token small; it rides in request bodies, not URLs, but a
 * tight encoding is still cheaper to log and to read in a debugger.
 */
interface QuotePayload {
  /** userId the quote belongs to. */
  u: string;
  /** fiatCurrency. */
  c: string;
  /** fiatPerUsd — the frozen rate. */
  r: number;
  /** rate source. */
  s: string;
  /** asOf, epoch ms. */
  a: number;
  /** issued at, epoch ms. */
  iat: number;
  /** expires at, epoch ms. */
  exp: number;
}

/**
 * Mint a signed quote token: `base64url(JSON payload)` + '.' + `base64url(HMAC)`.
 *
 * Node's `node:crypto` only — no third-party dependency, and no server state.
 */
export function issueQuote(input: QuoteInput): string {
  const ttlSeconds = input.ttlSeconds ?? env.QUOTE_TTL_SECONDS;
  const issuedAt = Date.now();

  const payload: QuotePayload = {
    u: input.userId,
    c: input.fiatCurrency,
    r: input.fiatPerUsd,
    s: input.source,
    a: input.asOf.getTime(),
    iat: issuedAt,
    exp: issuedAt + Math.round(ttlSeconds * 1000),
  };

  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

/**
 * Verify a quote token and return its frozen rate.
 *
 * Fails closed with a typed code: a missing token, a bad signature, a token that
 * has aged out, or one minted for somebody else. Callers MUST treat every one of
 * those as a refusal — never as a reason to fall back to the live rate, which is
 * the exact bug this mechanism exists to close.
 */
export function readQuote(token: string | null | undefined, userId: string): FrozenRate {
  if (typeof token !== 'string' || token.length === 0) {
    throw new QuoteError(
      'quote-missing',
      'A price quote is required to record this transfer. Fetch a preview and send its quoteId.'
    );
  }

  const parts = token.split('.');
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    throw new QuoteError('quote-invalid', 'That price quote is not readable.');
  }

  const [body, signature] = parts;

  // Signature FIRST: never parse a payload we have not authenticated.
  if (!signaturesMatch(signature, sign(body))) {
    throw new QuoteError('quote-invalid', 'That price quote failed verification.');
  }

  let payload: QuotePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as QuotePayload;
  } catch {
    throw new QuoteError('quote-invalid', 'That price quote is not readable.');
  }

  if (
    !payload ||
    typeof payload.u !== 'string' ||
    typeof payload.c !== 'string' ||
    typeof payload.r !== 'number' ||
    !Number.isFinite(payload.r) ||
    payload.r <= 0 ||
    typeof payload.s !== 'string' ||
    typeof payload.a !== 'number' ||
    typeof payload.exp !== 'number'
  ) {
    throw new QuoteError('quote-invalid', 'That price quote is not readable.');
  }

  if (payload.u !== userId) {
    throw new QuoteError(
      'quote-not-yours',
      'That price quote was issued to a different account.'
    );
  }

  if (Date.now() >= payload.exp) {
    throw new QuoteError(
      'quote-expired',
      'That price quote has expired. Refresh the amount and confirm it again.'
    );
  }

  return {
    fiatCurrency: payload.c,
    fiatPerUsd: payload.r,
    source: payload.s,
    asOf: new Date(payload.a),
  };
}
