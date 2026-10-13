/**
 * The business-name rule — a pure module, no database or chain dependency.
 *
 * It lives apart from `services/merchant-claims.ts` for the same reason
 * `lib/address.ts` lives apart from everything that uses an address: the rule is
 * needed at more than one boundary (validating a claim, and deciding whether a
 * QR payload is a business name), and a second copy of it would drift. A name is
 * the handle a customer resolves and the label a receipt carries, so the two
 * spellings must agree exactly.
 *
 * Deliberately NOT an identity rule. This says nothing about whether a business
 * is really called what it claims — that is the owner's KYB, out of scope. It
 * only refuses strings that cannot be a name at all.
 */

export const MERCHANT_NAME_MIN = 2;
export const MERCHANT_NAME_MAX = 64;

/** Letters (any script), digits, spaces and a small, useful punctuation set. */
const MERCHANT_NAME_ALLOWED = /^[\p{L}\p{N} .,'&()\-_+]+$/u;
const MERCHANT_NAME_HAS_ALNUM = /[\p{L}\p{N}]/u;
const MERCHANT_NAME_STARTS_ALNUM = /^[\p{L}\p{N}]/u;

/** Trim, and collapse runs of whitespace so `Java   House` == `Java House`. */
export function normalizeMerchantName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** The first-come key: the normalised name, lowercased. */
export function merchantNameKey(name: string): string {
  return normalizeMerchantName(name).toLowerCase();
}

/**
 * The merchant handle: the name lowercased with everything that cannot appear in
 * a link removed. `Java House` → `javahouse`.
 *
 * This is the `m/<handle>` in the link a customer is given
 * (`https://seti.live/m/javahouse`). It is a STORED, UNIQUE column, because the
 * handle is not the unique thing by itself: the rule DROPS characters, so
 * `Mama's Kitchen & Grill` and `Mamas Kitchen Grill` are two distinct names
 * (the uniqueness key keeps the space, the apostrophe and the ampersand) that
 * both reduce to `mamaskitchengrill`. Lowercasing cannot separate them; only
 * storing the handle and refusing the second claim can, so a payment link is
 * never ambiguous about which shop is paid.
 *
 * THE RULE LIVES HERE, and the web mirrors it EXACTLY in
 * `web/lib/merchant-link.ts` (`merchantHandle`). The two must produce the same
 * string for the same name — the stored handle is the one the printed link
 * carries, and a divergence would send a customer to a page that resolves to a
 * different merchant. `services/merchant-handle.check.ts` imports the web module
 * at runtime and asserts the two agree, so a drift fails the gate rather than
 * shipping.
 */
export function merchantHandle(name: string): string {
  return normalizeMerchantName(name).toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

/**
 * `null` when the name yields a usable handle, or a reason when it does not.
 *
 * A name can be valid and still make no link: the name rule accepts letters in
 * any script, but the handle rule keeps only `a–z`, `0–9`, `.`, `_`, `-`. A name
 * with no such character (`東京`) would produce an empty handle — a link to
 * `seti.live/m/` that names nobody — so it is refused here with the fix.
 */
export function describeMerchantHandle(name: string): string | null {
  if (merchantHandle(name).length === 0) {
    return (
      `"${normalizeMerchantName(name)}" cannot make a link: it has no letters a–z or digits. ` +
      'Add at least one so the name can appear in seti.live/m/…'
    );
  }

  return null;
}

/**
 * `null` when the name is usable, or a human-readable reason when it is not.
 *
 * Same shape as `describeEvmAddress`, and for the same reason: the caller sees
 * which rule failed instead of a bare "invalid".
 *
 * A name of only punctuation or whitespace is refused on purpose — it names
 * nobody, and it would let someone reserve a row of `!!!!` that a person cannot
 * tell apart from another.
 */
export function describeMerchantName(name: string): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return 'A business name is required.';
  }

  const normalized = normalizeMerchantName(name);

  if (normalized.length < MERCHANT_NAME_MIN || normalized.length > MERCHANT_NAME_MAX) {
    return `A business name must be ${MERCHANT_NAME_MIN}–${MERCHANT_NAME_MAX} characters long (this one is ${normalized.length}).`;
  }

  if (!MERCHANT_NAME_ALLOWED.test(normalized)) {
    return (
      `"${normalized}" contains characters a business name cannot use. Letters, digits, ` +
      `spaces and . , ' & ( ) - _ + are allowed.`
    );
  }

  if (!MERCHANT_NAME_HAS_ALNUM.test(normalized)) {
    return 'A business name must contain at least one letter or digit — punctuation or spaces alone name nobody.';
  }

  if (!MERCHANT_NAME_STARTS_ALNUM.test(normalized)) {
    return 'A business name must start with a letter or digit.';
  }

  return null;
}
