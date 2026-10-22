/**
 * The constants a charge is defined by.
 *
 * Kept apart from the types so a reader can see the three facts that decide what
 * this page will accept, without reading a loader: the id shape, the QR scheme, and
 * the fee.
 */

/**
 * What a charge id may look like.
 *
 * A charge id is an opaque handle, not a capability on its own — the signature is
 * what makes a request payable — but it is still typed into URLs and printed in
 * QR codes, so it is restricted to the characters a URL path tolerates without
 * encoding. Checked BEFORE the source is asked, so a request for
 * `/pay/<script>` never reaches a lookup.
 */
export const CHARGE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{5,63}$/;

/**
 * The QR payload's scheme. `seti://pay/<id>`.
 *
 * The code carries the ID, not the address and not the amount. Two reasons, and
 * both are about what a scan can promise: the charge is the thing that was signed,
 * so a scanner resolves the same signed object the page resolved rather than a
 * figure lifted off a screen (a repriced charge would make the printed code lie);
 * and payee, amount and memo then travel inside that one id, so they cannot be
 * edited independently of each other.
 *
 * A wallet that does not know `seti:` falls back to scanning the address, which is
 * on the page anyway.
 */
export const CHARGE_URI_PREFIX = 'seti://pay/';

/**
 * The platform fee, in percent of the charge.
 *
 * Mirrors `MERCHANT_FEE_PERCENT`'s default in `backend/src/config/env.ts`, and the
 * backend is the source of truth: `backend/src/services/fees.ts` computes the fee
 * that is actually collected, with no floor and no cap (`MERCHANT_FEE_MIN_KES` and
 * `MERCHANT_FEE_MAX_PERCENT` are both 0 by default). This copy exists because the
 * page must show the fee BEFORE anything is signed, and it may not ask the backend
 * to price a charge that does not exist yet. When #131 lands, the fee arrives on the
 * charge and this constant goes away.
 */
export const PLATFORM_FEE_PERCENT = 2;

/**
 * How many characters of an address are enough to recognise it.
 *
 * Six leading and four trailing: the app's `shortenValue` shows eight, but this is
 * the one place an address stands where a name would be, on a 390px screen beside a
 * badge that eats 110px. The full address is always in the element's `title`, and
 * in the HTML, so a careful payer can check every character.
 */
export const SHORT_ADDRESS_LEAD = 6;
export const SHORT_ADDRESS_TAIL = 4;

/** A Tempo/EVM address, lowercase-hex, exactly as stored. */
export const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;

/** A handle, in the shape `backend/src/lib/payee.ts` accepts. */
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,62}$/;
