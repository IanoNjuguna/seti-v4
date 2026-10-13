/**
 * The one HMAC primitive and the one signing secret in the backend.
 *
 * Two features now hand a signed token to a client: the price quote (a frozen FX
 * rate the record path must honour) and the receipt link (a capability to read
 * one receipt without a session). They are different promises but the SAME
 * scheme — `base64url(JSON payload)` + '.' + `base64url(HMAC-SHA256)`, keyed by
 * `QUOTE_SIGNING_SECRET` — so the scheme lives here once. A second copy would be
 * a second place to get constant-time comparison or secret handling wrong, and
 * the two would drift.
 *
 * Extracted verbatim from `services/quote.ts`; `quote.ts` now imports it, so the
 * quote behaviour (including the warn-once random fallback) is unchanged.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

let generatedSecret: Buffer | null = null;
let warnedAboutMissingSecret = false;

/**
 * The HMAC key used to sign and verify tokens.
 *
 * A configured secret is used verbatim. When it is unset the process mints a
 * random one and warns ONCE: tokens are still unforgeable, but they are pinned
 * to this process, so an outstanding token does not survive a restart and a
 * second instance cannot read the first's. That is a development convenience
 * only — production must set `QUOTE_SIGNING_SECRET`.
 */
export function signingSecret(): Buffer {
  const configured = env.QUOTE_SIGNING_SECRET;
  if (configured && configured.length > 0) return Buffer.from(configured, 'utf8');

  if (!generatedSecret) generatedSecret = randomBytes(32);

  if (!warnedAboutMissingSecret) {
    warnedAboutMissingSecret = true;
    console.warn(
      '[signed-token] QUOTE_SIGNING_SECRET is not set. Using a random per-process key: ' +
        'outstanding tokens will not survive a restart, and a second instance cannot ' +
        'read them. Set QUOTE_SIGNING_SECRET in production.'
    );
  }

  return generatedSecret;
}

export function sign(body: string): string {
  return createHmac('sha256', signingSecret()).update(body).digest('base64url');
}

/**
 * Constant-time string comparison.
 *
 * `timingSafeEqual` throws on unequal lengths, which would itself leak the
 * expected length through an exception, so the length is checked first and the
 * compare only runs on equal-length inputs.
 */
export function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
