/**
 * Verifying a Seti webhook on the RECEIVER's side — the logic behind the snippet a
 * merchant pastes into their own server.
 *
 * It lives in the backend, not only in the docs, for one reason: a snippet that
 * nobody executes is a snippet that drifts. The check suite calls this function with
 * the same header a delivery produces, and `docs/receive.md` carries a copy a
 * merchant can paste that is asserted against this file's constants. If either
 * changes alone, a check fails.
 *
 * ## What the sender does (and therefore what a receiver must do)
 *
 *   1. Sign `"<t>.<raw body>"` with HMAC-SHA256, keyed by the app's secret.
 *   2. Send `X-Seti-Signature: t=<unix seconds>,v1=<lower-case hex>`.
 *   3. Send the body as JSON.
 *
 * ## The three steps, in order, and why the order matters
 *
 * 1. **Parse the header.** A missing or unparseable header is a failure, never a
 *    pass. There is no "unsigned but trusted" mode.
 * 2. **Reject a stale `t`.** The timestamp is INSIDE the signed string, so a
 *    captured header cannot be replayed against a different instant — but a captured
 *    header can be replayed against the SAME one, forever, unless the receiver
 *    bounds its age. {@link WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS} (5 minutes) is
 *    wide enough for a clock that drifts and narrow enough that a leaked body is
 *    dead by the time anyone can use it. Both directions are checked: a header
 *    dated in the future is refused, because a forged `t` would otherwise extend
 *    its own life.
 * 3. **Compare the MAC in constant time.** `timingSafeEqual` over equal-length
 *    buffers, never `===`. A byte-by-byte compare that exits early leaks how much of
 *    a guess was right, which is how a signature gets forged one nibble at a time.
 *
 * ## The raw body, not a re-serialised object
 *
 * JSON has many spellings for one value (key order, whitespace, `1.0` vs `1`). A
 * `JSON.stringify(req.body)` after parsing can produce different bytes than the ones
 * that arrived, the MAC then covers different bytes than the sender signed, and the
 * check fails on a delivery that was perfectly valid. The receiver must hash the
 * bytes it received — `express.raw()`, or `await request.text()` in a Next.js route
 * handler — and parse the JSON afterwards.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** The header carrying the signature. The ONE definition; the sender imports it. */
export const WEBHOOK_SIGNATURE_HEADER = 'x-seti-signature';

/**
 * How old a signature may be, in seconds. Five minutes.
 *
 * Mirrors the window `docs/receive.md` tells a merchant to use, and the exact value
 * is asserted by `check:merchant-app`, so the doc and the sender cannot drift.
 */
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

/** The reasons a delivery does not verify. Each names a different fix. */
export type WebhookSignatureFailure =
  /** No `x-seti-signature` header at all. */
  | 'missing-header'
  /** Present but not `t=<digits>,v1=<hex>`. */
  | 'malformed-header'
  /** Parsed, but `t` is outside the tolerance window in either direction. */
  | 'stale-timestamp'
  /** The MAC does not match: a wrong secret, or a body that was altered. */
  | 'signature-mismatch';

export type WebhookSignatureVerdict =
  | { ok: true; timestampSeconds: number }
  | { ok: false; reason: WebhookSignatureFailure };

/** `t=1761130000,v1=<hex>` → its parts, or `null` when it is not that shape. */
export function parseSignatureHeader(
  header: string | null | undefined
): { timestampSeconds: number; signature: string } | null {
  if (typeof header !== 'string' || header.length === 0) return null;

  let timestampSeconds: number | null = null;
  let signature: string | null = null;

  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (name === 't' && /^\d{1,12}$/.test(value)) timestampSeconds = Number(value);
    if (name === 'v1' && /^[0-9a-f]{64}$/i.test(value)) signature = value.toLowerCase();
  }

  if (timestampSeconds === null || signature === null) return null;
  return { timestampSeconds, signature };
}

/**
 * Verify one delivery.
 *
 * `rawBody` is the exact bytes received, as a string. `now` is injectable so the
 * check suite can prove the window rather than wait five minutes for it.
 */
export function verifySetiWebhookSignature(input: {
  header: string | null | undefined;
  rawBody: string;
  secret: string;
  now?: Date;
  toleranceSeconds?: number;
}): WebhookSignatureVerdict {
  if (!input.header) return { ok: false, reason: 'missing-header' };

  const parsed = parseSignatureHeader(input.header);
  if (!parsed) return { ok: false, reason: 'malformed-header' };

  const tolerance = input.toleranceSeconds ?? WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - parsed.timestampSeconds) > tolerance) {
    return { ok: false, reason: 'stale-timestamp' };
  }

  const expected = createHmac('sha256', input.secret)
    .update(`${parsed.timestampSeconds}.${input.rawBody}`)
    .digest('hex');

  if (!signaturesMatch(expected, parsed.signature)) {
    return { ok: false, reason: 'signature-mismatch' };
  }

  return { ok: true, timestampSeconds: parsed.timestampSeconds };
}

/**
 * Constant-time comparison of two hex MACs.
 *
 * The length check comes first because `timingSafeEqual` THROWS on unequal lengths,
 * and an exception is itself a length oracle. A length difference here can only come
 * from a malformed header, which `parseSignatureHeader` has already refused; the
 * check stays anyway so this function is safe to reuse.
 */
function signaturesMatch(expected: string, received: string): boolean {
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(received, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
