/**
 * The handle-name rule — a pure module, no database or chain dependency.
 *
 * ONE rule for ONE namespace. A person's USERNAME and a business's NAME are the
 * same kind of handle and compete for the same string, so they are normalised,
 * keyed and reduced by the same functions here. There is no second rule for
 * usernames; a divergence between the two would let one string mean two things.
 *
 * It lives apart from `services/handle-claims.ts` for the same reason
 * `lib/address.ts` lives apart from everything that uses an address: the rule is
 * needed at more than one boundary (validating a claim, and deciding whether a
 * QR payload is a handle), and a second copy of it would drift. A handle is the
 * string a customer resolves and the label a receipt carries, so the two
 * spellings must agree exactly.
 *
 * Deliberately NOT an identity rule. This says nothing about whether a business
 * is really called what it claims — that is the owner's KYB, out of scope. It
 * only refuses strings that cannot be a handle at all, and the ones Seti keeps
 * for itself (see RESERVED_HANDLES).
 */

export const MERCHANT_NAME_MIN = 2;
export const MERCHANT_NAME_MAX = 64;

/**
 * A HANDLE's limits, which are not a name's.
 *
 * The TikTok username rule, and the point of using a rule people already know: a
 * handle is typed from memory, printed on a sticker and read out loud, so the rule
 * has to fit in a head. Letters, numbers, periods and underscores, 2 to 24 of them,
 * no period at either end.
 *
 * The NAME keeps its own wider rule above (spaces, apostrophes, ampersands and
 * brackets, up to 64 characters), because a business has to be able to type its own
 * name. What it cannot do is print a link with an apostrophe in it, and today the
 * hint under the field promised characters the handle rule silently removed.
 */
export const HANDLE_MIN = 2;
export const HANDLE_MAX = 24;

/**
 * The strings Seti keeps for itself.
 *
 * Enforced at CLAIM TIME, so no one can squat the product's own brand before
 * merchants print a sticker, or before a user pastes `seti.live/u/pay` into a
 * chat. Compared against the derived HANDLE (lowercased, `[a-z0-9._]`), not the
 * raw name, because `Seti`, `seti` and `s e t i` all reduce to the same string a
 * customer would type. `seti` is already held by the merchant that claimed it;
 * the list also refuses it as a NEW claim, so the reservation survives the row.
 */
export const RESERVED_HANDLES = [
  'seti',
  'support',
  'admin',
  'help',
  'pay',
  'api',
  'www',
  'terms',
  'privacy',
] as const;

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
 * The handle: the name lowercased with everything that cannot appear in a link
 * removed. `Java House` → `javahouse`, `Ian` → `ian`.
 *
 * The characters that SURVIVE are `a–z`, `0–9`, `.` and `_`: the TikTok username
 * rule, chosen because it is one people already know. Everything else is dropped
 * rather than escaped or hyphenated — an escaped handle in a printed link is
 * unusable (`%2C` on a sticker is not a handle), and a hyphen inserted by us would
 * make `Java House` and `Java-House` two different links for one name.
 *
 * This is the `<handle>` in the link a customer is given — `seti.live/m/<handle>`
 * for a business, `seti.live/u/<handle>` for a person. It is a STORED, UNIQUE
 * column (`Handle.handle`), because the handle is not the unique thing by itself:
 * the rule DROPS characters, so `Mama's Kitchen & Grill` and `Mamas Kitchen
 * Grill` are two distinct names (the uniqueness key keeps the space, the
 * apostrophe and the ampersand) that both reduce to `mamaskitchengrill`.
 * Lowercasing cannot separate them; only storing the handle and refusing the
 * second claim can, so a payment link is never ambiguous about which party is
 * paid — person or business alike.
 *
 * THE RULE LIVES HERE, and the web mirrors it EXACTLY in
 * `web/lib/merchant-link.ts` (`merchantHandle`). The two must produce the same
 * string for the same name — the stored handle is the one the printed link
 * carries, and a divergence would send a customer to a page that resolves to a
 * different party. `services/merchant-handle.check.ts` and
 * `services/username.check.ts` import the web module at runtime and assert the
 * two agree, so a drift fails the gate rather than shipping.
 */
export function merchantHandle(name: string): string {
  return normalizeMerchantName(name).toLowerCase().replace(/[^a-z0-9._]/g, '');
}

/** The same rule, under the name that reads for a person's username too. */
export const handleOf = merchantHandle;

/**
 * `null` when the name yields a usable handle, or a reason when it does not.
 *
 * A name can be valid and still make no link: the name rule accepts letters in
 * any script, but the handle rule keeps only `a–z`, `0–9`, `.` and `_`. A name
 * with no such character (`東京`) would produce an empty handle — a link to
 * `seti.live/…/` that names nobody — so it is refused here with the fix.
 *
 * The LENGTH and EDGE rules are the handle's, not the name's, and they are checked
 * here because this is the only place both the name and the string it reduces to
 * are known. A 64 character name is a legitimate name; a 64 character handle is a
 * link nobody will type, and it is not what the field's hint says the person is
 * choosing.
 */
export function describeMerchantHandle(name: string): string | null {
  const handle = merchantHandle(name);

  if (handle.length === 0) {
    return (
      `"${normalizeMerchantName(name)}" cannot make a link: it has no letters a–z or digits. ` +
      'Add at least one so the name can appear in a seti.live link.'
    );
  }

  if (handle.length < HANDLE_MIN) {
    return (
      `"${normalizeMerchantName(name)}" is too short for a link: a handle is ` +
      `${HANDLE_MIN} to ${HANDLE_MAX} letters, numbers, periods or underscores.`
    );
  }

  if (handle.length > HANDLE_MAX) {
    return (
      `"${handle}" is too long for a link: a handle is ${HANDLE_MIN} to ${HANDLE_MAX} ` +
      'letters, numbers, periods or underscores. Shorten the name.'
    );
  }

  if (handle.startsWith('.') || handle.endsWith('.')) {
    return `"${handle}" cannot start or end with a period.`;
  }

  return null;
}

/** The handle-shape rule under the name that reads for a username too. */
export const describeHandleOf = describeMerchantHandle;

/** `true` when a name reduces to a handle Seti reserves for itself. */
export function isReservedHandle(name: string): boolean {
  return (RESERVED_HANDLES as readonly string[]).includes(merchantHandle(name));
}

/**
 * `null` when the name is not reserved, or the refusal that names the fix.
 *
 * Runs AFTER the handle-shape rule: a name that makes no handle at all is
 * refused by that rule first, so this one never has to speak for an empty
 * handle. `seti` is on the list even though a merchant already holds the row —
 * the reservation is about the STRING, not about who happens to hold it.
 */
export function describeReservedHandle(name: string): string | null {
  const handle = merchantHandle(name);

  if (handle.length === 0) return null;

  if ((RESERVED_HANDLES as readonly string[]).includes(handle)) {
    return (
      `"${handle}" is reserved by Seti and cannot be claimed. ` +
      'Choose another name — the product\u2019s own links are not for sale.'
    );
  }

  return null;
}

/**
 * `null` when the name is usable, or a human-readable reason when it is not.
 *
 * Same shape as `describeEvmAddress`, and for the same reason: the caller sees
 * which rule failed instead of a bare "invalid". Governs a person's username and
 * a business's name alike.
 *
 * A name of only punctuation or whitespace is refused on purpose — it names
 * nobody, and it would let someone reserve a row of `!!!!` that a person cannot
 * tell apart from another.
 */
export function describeMerchantName(name: string): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return 'A name is required.';
  }

  const normalized = normalizeMerchantName(name);

  if (normalized.length < MERCHANT_NAME_MIN || normalized.length > MERCHANT_NAME_MAX) {
    return `A name must be ${MERCHANT_NAME_MIN}–${MERCHANT_NAME_MAX} characters long (this one is ${normalized.length}).`;
  }

  if (!MERCHANT_NAME_ALLOWED.test(normalized)) {
    return (
      `"${normalized}" contains characters a name cannot use. Letters, digits, ` +
      `spaces and . , ' & ( ) - _ + are allowed.`
    );
  }

  if (!MERCHANT_NAME_HAS_ALNUM.test(normalized)) {
    return 'A name must contain at least one letter or digit — punctuation or spaces alone name nobody.';
  }

  if (!MERCHANT_NAME_STARTS_ALNUM.test(normalized)) {
    return 'A name must start with a letter or digit.';
  }

  return null;
}

/** The name-shape rule under the name that reads for a username too. */
export const describeHandleName = describeMerchantName;
