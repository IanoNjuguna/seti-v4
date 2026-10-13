/**
 * The HELD-BRAND list — the real-world names Seti knows of and will not let go
 * live under a stranger's address without a person looking first.
 *
 * It lives beside the RESERVED words (`lib/merchant-name.ts`) and is the SAME
 * KIND OF LIST, but it is NOT the same rule, and the difference is the whole
 * point:
 *
 *   - A RESERVED word is a string Seti keeps for ITSELF. It is refused outright,
 *     before anything is signed (`describeReservedHandle`).
 *   - A HELD brand is someone ELSE'S name. Seti does not decide a claim to it is
 *     impersonation — a brand's own staff, franchisees and resellers are real
 *     claimants. So a claim that matches a held brand is PARKED for review, not
 *     refused. Parking accuses no one and does not lock the genuine owner out.
 *
 * ONE editable list, ONE file. To hold another brand, add an entry here — there
 * is no second place that has to agree, and no schema change.
 *
 * ## The matching rule (and why it is not `merchantHandle`)
 *
 * Reserved words are compared against the DERIVED HANDLE (`merchantHandle`), which
 * keeps `.`, `_` and `-`. A held brand needs to catch more than that, because the
 * point is to catch the SPELLINGS a squatter reaches for: `K.F.C` keeps its dots
 * under the handle rule (`k.f.c`), and `kfc-kenya` keeps its hyphen. So the brand
 * key here strips EVERYTHING that is not a letter or a digit — lowercase,
 * punctuation and spacing all gone — and matches on that:
 *
 *   `KFC`         → `kfc`         (equals the brand key)
 *   `K.F.C`       → `kfc`         (dots stripped)
 *   `K F C`       → `kfc`         (spaces stripped)
 *   `kfc-kenya`   → `kfckenya`    (a TOKEN — `kfc` — begins the name)
 *   `KFC Karibu`  → `kfckaribu`   (a token equals the brand key)
 *   `Java House`  → `javahouse`   (equals the brand key)
 *   `Java House Grill` → a token run (`java`,`house`) and a key prefix
 *
 * Two comparisons, both on the same normalised form:
 *
 *   1. TOKEN RUN — the brand's tokens appear consecutively in the name's tokens,
 *      so `Best KFC` and `KFC Karibu` both hit a one-token `KFC`.
 *   2. KEY PREFIX — the name's fully-stripped key STARTS WITH the brand's, so a
 *      brand glued to a suffix with no separator (`KFCFood`, `kfc-kenya`,
 *      `JavaHouseGrill`) still hits.
 *
 * It is deliberately imperfect, and the policy says so: a misspelling or a
 * homoglyph slips past a list keyed on plain letters. See docs/brand-policy.md
 * §5. A name getting through is not an endorsement; it is the matcher finding
 * nothing.
 */

export interface HeldBrand {
  /** The brand as it is spelled, for matching and for the review message. */
  name: string;
  /** What the claimer must send to be verified — the proof, named plainly. */
  evidence: string;
}

/**
 * The brands Seti holds. Seeded from the two that were squatted on a live
 * instance (KFC, BurgerKing) and two more it knows of.
 */
export const HELD_BRANDS: readonly HeldBrand[] = [
  {
    name: 'KFC',
    evidence:
      'a KFC franchise agreement, or a letter from KFC authorising you to use the name',
  },
  {
    name: 'BurgerKing',
    evidence:
      'a Burger King franchise agreement, or a letter from Burger King authorising you to use the name',
  },
  {
    name: 'Safaricom',
    evidence:
      'proof that this is Safaricom itself or an authorised Safaricom dealer',
  },
  {
    name: 'Java House',
    evidence:
      'proof that this is Java House itself or an authorised Java House franchisee',
  },
];

/**
 * The evidence named when a parked row's brand is no longer on the list — a row
 * parked before the list changed must still be able to say what to send.
 */
export const HELD_BRAND_EVIDENCE_FALLBACK =
  'proof that this name is yours — a registration document or a letter from the brand';

/** Every alphanumeric run in a name, lowercased. Punctuation and spacing split. */
export function heldBrandTokens(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** The name's key: lowercase with ALL punctuation and spacing stripped. */
export function heldBrandKey(name: string): string {
  return heldBrandTokens(name).join('');
}

/** True when `haystack` contains `needle` as a contiguous run of tokens. */
function containsTokenRun(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;

  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    let matches = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
}

/**
 * The held brand a name matches, or `null` when it matches none.
 *
 * Exported for the claim path, the live preview and the checks — ONE rule, so
 * the preview cannot tell a person a name is ordinary that the claim then parks.
 */
export function matchHeldBrand(name: string): HeldBrand | null {
  const tokens = heldBrandTokens(name);
  if (tokens.length === 0) return null;

  const key = tokens.join('');

  for (const brand of HELD_BRANDS) {
    const brandTokens = heldBrandTokens(brand.name);
    if (brandTokens.length === 0) continue;

    if (containsTokenRun(tokens, brandTokens)) return brand;
    if (key.startsWith(brandTokens.join(''))) return brand;
  }

  return null;
}

/** The held brand's spelled name a claim matches, or `null`. */
export function describeHeldBrand(name: string): string | null {
  return matchHeldBrand(name)?.name ?? null;
}

/** The held brand for a name, or `null` — the lookup the preview uses. */
export function heldBrandByName(name: string): HeldBrand | null {
  const target = name.trim().toLowerCase();
  return HELD_BRANDS.find((brand) => brand.name.toLowerCase() === target) ?? null;
}

/**
 * What a parked row's claimer must send, given the stored brand name.
 *
 * Reads the CURRENT list, so a corrected `evidence` line reaches every parked
 * claim at once; falls back to a generic proof when the brand is no longer on
 * the list, so an old parked row can still be explained.
 */
export function heldBrandEvidence(brand: string | null): string {
  if (!brand) return HELD_BRAND_EVIDENCE_FALLBACK;
  return heldBrandByName(brand)?.evidence ?? HELD_BRAND_EVIDENCE_FALLBACK;
}
