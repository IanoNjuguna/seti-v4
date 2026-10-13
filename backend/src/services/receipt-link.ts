/**
 * The shareable receipt link: an opaque public id plus a capability token.
 *
 * WHY THIS EXISTS
 *
 * A receipt is proof of one payment, and a customer wants to hand it to the
 * merchant on the other side. Until now a receipt was only reachable through the
 * owner's session (`GET /transactions/:id/receipt`), which the merchant does not
 * have. This adds a second door the owner can open deliberately: a link anyone
 * holding it can read, once, read-only, for a day.
 *
 * WHY THE ID IS NOT THE HASH
 *
 * The obvious handle is the txHash — it already identifies the transfer. It is
 * refused, deliberately. A chain is public and enumerable: anyone can walk its
 * transactions, so a page keyed by the hash would be a tidier MIRROR of a public
 * chain that also leaked OUR enrichment of it — the customer↔transfer link, the
 * merchant's name, the fiat figure and the rate we priced it at. The public id
 * is therefore an OPAQUE, keyed value that cannot be derived from the chain.
 *
 * WHY IT IS DERIVED, NOT STORED
 *
 * The id is `HMAC(secret, "receipt:" + row.id)` — deterministic, so no column and
 * no migration is needed, and the same row always yields the same link. It is
 * keyed, so a stranger who guesses or reads a row id still cannot compute the
 * public id, and the id is not reversible into the row id.
 *
 * TWO DOORS, DELIBERATELY DIFFERENT
 *
 *  (a) the OWNER, by session — `GET /transactions/:id/receipt` still scopes to
 *      the caller and 404s otherwise; unchanged.
 *  (b) anyone the owner SHARES with, by the token below.
 *
 * The token is HMAC over (receipt id + scope + expiry), using the SAME primitive
 * and the SAME secret as the price quote (`lib/signed-token.ts`). The scope
 * (`receipt:read`) lives INSIDE the signed payload, never in a path or query
 * parameter a client could widen — a parameter is a request, a signed claim is
 * a fact.
 */
import { createHmac } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { sign, signaturesMatch, signingSecret } from '../lib/signed-token.js';
import { buildReceipt, type ReceiptDocument } from './receipt.js';

/** A shared link is good for a day: long enough to send, short enough to forget. */
export const RECEIPT_LINK_TTL_SECONDS = 24 * 60 * 60;

/** The one thing this capability grants. Read-only, by construction. */
export const RECEIPT_LINK_SCOPE = 'receipt:read';

/**
 * The opaque, non-guessable public id for a row.
 *
 * Keyed HMAC of the row id, base64url, truncated to 22 chars (~132 bits). An
 * attacker without the secret cannot compute it from the row id, and cannot
 * invert it into the row id.
 */
export function receiptIdFor(transactionId: string): string {
  return createHmac('sha256', signingSecret())
    .update(`receipt:${transactionId}`)
    .digest('base64url')
    .slice(0, 22);
}

/**
 * The signed payload.
 *
 * `t` is the row the token authorises, and it is safe to carry: the payload is
 * signed, so an attacker cannot choose it, and a row id is not itself a
 * credential — the token is. `r` binds the token to the public id it was minted
 * for. `s` is the scope and `exp` the expiry; both are checked, never trusted
 * from the URL.
 */
interface ReceiptTokenPayload {
  /** The ledger row's id. */
  t: string;
  /** The opaque public id this token is for. */
  r: string;
  /** The granted scope — always `receipt:read`. */
  s: string;
  /** issued at, epoch ms. */
  iat: number;
  /** expires at, epoch ms. */
  exp: number;
}

/** A verified capability: the row to read, and the id it is bound to. */
export interface ReceiptGrant {
  transactionId: string;
  receiptId: string;
  scope: string;
}

/** Mint a token for one row: `base64url(payload)` + '.' + `base64url(HMAC)`. */
export function issueReceiptToken(
  transactionId: string,
  ttlSeconds: number = RECEIPT_LINK_TTL_SECONDS
): { token: string; expiresAt: Date } {
  const receiptId = receiptIdFor(transactionId);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + Math.round(ttlSeconds * 1000);

  const payload: ReceiptTokenPayload = {
    t: transactionId,
    r: receiptId,
    s: RECEIPT_LINK_SCOPE,
    iat: issuedAt,
    exp: expiresAt,
  };

  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return { token: `${body}.${sign(body)}`, expiresAt: new Date(expiresAt) };
}

/**
 * Verify a token and return its grant, or null for EVERY failure.
 *
 * Null rather than a typed error on purpose: the route turns a missing token, a
 * forged one, an expired one and a wrong-scope one into the SAME 404, so the
 * endpoint cannot be used to learn which condition failed — or whether a guessed
 * id exists at all.
 */
export function readReceiptToken(token: string | null | undefined): ReceiptGrant | null {
  if (typeof token !== 'string' || token.length === 0) return null;

  const parts = token.split('.');
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) return null;

  const [body, signature] = parts;

  // Signature FIRST: never parse a payload we have not authenticated.
  if (!signaturesMatch(signature, sign(body))) return null;

  let payload: ReceiptTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ReceiptTokenPayload;
  } catch {
    return null;
  }

  if (
    !payload ||
    typeof payload.t !== 'string' ||
    typeof payload.r !== 'string' ||
    typeof payload.s !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return null;
  }

  if (payload.s !== RECEIPT_LINK_SCOPE) return null;
  if (Date.now() >= payload.exp) return null;

  return { transactionId: payload.t, receiptId: payload.r, scope: payload.s };
}

/**
 * Mint the link an owner can hand out, or null when the row is not theirs.
 *
 * Same precondition as the owner's own receipt: the row must be the caller's and
 * must have something on chain to show. A row that fails either is indistinguishable
 * from a row that does not exist.
 */
export async function mintReceiptLink(
  transactionId: string,
  userId: string
): Promise<{ path: string; expiresAt: Date } | null> {
  const row = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    select: { id: true, txHash: true },
  });

  if (!row?.txHash) return null;

  const { token, expiresAt } = issueReceiptToken(row.id);
  const path = `/r/${receiptIdFor(row.id)}?t=${encodeURIComponent(token)}`;

  return { path, expiresAt };
}

/**
 * The receipt behind a shared link, or null for every reason to refuse.
 *
 * Refused identically whether the id is unknown, the token is missing, forged or
 * expired, or the token was minted for a different receipt: one 404 for all of
 * them, so the endpoint cannot be probed for which ids exist.
 */
export async function readSharedReceipt(
  publicId: string,
  token: string | null | undefined
): Promise<ReceiptDocument | null> {
  const grant = readReceiptToken(token);
  if (!grant) return null;

  // The token names the id it was minted for; it must be the id in the URL.
  if (grant.receiptId !== publicId) return null;

  const row = await prisma.transaction.findUnique({
    where: { id: grant.transactionId },
    select: { id: true, userId: true },
  });
  if (!row) return null;

  // Bind the URL id to the row once more, independently of the token payload:
  // the id in the path must be the one this row derives.
  if (receiptIdFor(row.id) !== publicId) return null;

  // The chain is read exactly as the owner's own receipt reads it.
  return buildReceipt(row.id, row.userId);
}
