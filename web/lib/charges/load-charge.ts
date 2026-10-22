import { CHARGE_ID_PATTERN } from './charge.constants';
import { resolveChargeStatus } from './charge-status';
import { FIXTURE_PAYEE_DIRECTORY, fixtureChargeSource, fixtureSignatureFor } from './charge.fixture';
import { parseStoredCharge } from './charge.validate';
import { resolvePayee } from './resolve-payee';
import type { ChargeLoadResult, ChargeSource, PayeeDirectory, PayCharge, StoredCharge } from './charge.types';

/**
 * ============================================================================
 * THE SEAM. #131 replaces this file with the real charge source.
 * ============================================================================
 *
 * Charges do not exist in the backend yet (#129 builds them, #131 serves them), so
 * this is the one place a charge enters the web app, and it is deliberately the ONLY
 * place: no route, component or hook imports the fixture, and no endpoint or database
 * model is invented here to stand in for one. When #131 lands it supplies a
 * `ChargeSource` that reads the real charge, and the only edit in this file is which
 * `source` the defaults point at.
 *
 * What the page is promised, whatever the source:
 *
 *   - a charge it may render (`charge`), with the recipient already resolved and the
 *     status already decided on the SERVER, so a wallet-less phone can read it;
 *   - `not-found` for an id that does not name one;
 *   - `invalid` for anything whose signature does not hold or whose payload does not
 *     parse. That is a refusal, not a warning: the page draws no amount, no recipient
 *     and no code for it, because a forged amount shown carefully is still a forged
 *     amount.
 *
 * THE SIGNATURE, HONESTLY. The genuine check is an HMAC over the charge's fields,
 * verified where the signing secret lives — the backend (`lib/signed-token.ts`), the
 * same primitive the receipt links use. A Next app must not hold that secret, so the
 * real source will answer "this does not verify" rather than have the page recompute
 * it. The comparison below is therefore a STAND-IN: it asks the fixture whether the
 * signature matches the id it claims, which is enough to keep the refusal path real
 * and exercised (see `/pay/ch_1a7f4e9c2d60`) and is not cryptography.
 *
 * Unchanged by #131, and load-bearing: the id shape is checked before any lookup, the
 * payload is parsed rather than trusted, and a status is derived from the money and
 * the clock (never read off a stored flag).
 */

/** Everything `loadCharge` depends on. Injected so the check suite can pin each path. */
export interface ChargeLoadDeps {
  source: ChargeSource;
  directory: PayeeDirectory;
  /** The instant "expired" is decided at. Injected because `new Date()` inside render is a hydration bug. */
  now: Date;
}

/**
 * Load one charge by id.
 *
 * `deps` is a partial override for tests only; the route calls it with the id alone.
 */
export async function loadCharge(
  id: string,
  deps: Partial<ChargeLoadDeps> = {}
): Promise<ChargeLoadResult> {
  if (!CHARGE_ID_PATTERN.test(id)) return { kind: 'not-found' };

  const source = deps.source ?? fixtureChargeSource;
  const directory = deps.directory ?? FIXTURE_PAYEE_DIRECTORY;
  const now = deps.now ?? new Date();

  const raw = await source.read(id);
  if (raw === null || raw === undefined) return { kind: 'not-found' };

  const stored = parseStoredCharge(raw);

  // A payload that will not parse is refused with the same words as a forged one.
  // Distinguishing them on a public page would tell an attacker which half to fix.
  if (!stored || stored.id !== id) return { kind: 'invalid' };
  if (!signatureHolds(stored)) return { kind: 'invalid' };

  const payee = await resolvePayee(directory, stored.recipientAddress);
  const status = resolveChargeStatus(stored, now);

  return { kind: 'charge', charge: toPayCharge(stored), payee, status };
}

/**
 * Whether the source's signature holds.
 *
 * The stand-in described in the seam note above: it compares what the source minted
 * for this charge with what it would mint for the id the charge claims, so a payload
 * borrowed from another charge fails. Replaced wholesale by #131.
 */
function signatureHolds(stored: StoredCharge): boolean {
  return stored.signature === fixtureSignatureFor(stored.id);
}

/** The stored charge without its signature — the only version a component may see. */
function toPayCharge(stored: StoredCharge): PayCharge {
  return {
    id: stored.id,
    currency: stored.currency,
    amount: stored.amount,
    received: stored.received,
    recipientAddress: stored.recipientAddress,
    memo: stored.memo,
    expiresAt: stored.expiresAt,
    paidAt: stored.paidAt,
    receiptPath: stored.receiptPath,
  };
}
