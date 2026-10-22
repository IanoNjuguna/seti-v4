import { CHARGE_ID_PATTERN } from './charge.constants';
import { resolveChargeStatus } from './charge-status';
import { addressPayeeDirectory, chargeSource } from './charge-source';
import { parseStoredCharge } from './charge.validate';
import { resolvePayee } from './resolve-payee';
import type {
  ChargeLoadResult,
  ChargeSource,
  PayeeDirectory,
  PayCharge,
  StoredCharge,
} from './charge.types';

/**
 * ============================================================================
 * THE SEAM, NOW WIRED TO REAL CHARGES (#131).
 * ============================================================================
 *
 * This is the one place a charge enters the web app, and it is deliberately the ONLY
 * place: no route, component or hook reaches for the API itself. Until #131 the
 * defaults here pointed at a fixture (`charge.fixture.ts`); they now point at
 * `charge-source.ts`, which reads `GET /public/charges/:id`. The fixture is still
 * imported by the CHECK SUITE (`web/scripts/check-pay-charge.mjs`), as a test double
 * injected through `deps.source` — never by anything a deployed build can reach, which
 * is what #161 asked for and what this wiring makes STRUCTURAL rather than a flag.
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
 * THE SIGNATURE, HONESTLY. The page does not verify it. The real source is the
 * backend, which re-verifies the recipient's EIP-712 signature from the stored bytes
 * on every read and answers `422 charge-signature-invalid` when it fails; that answer
 * arrives here as `{ kind: 'refused' }` and becomes `invalid`. A source that cannot
 * make the check says so rather than letting this app keep a second copy of it to
 * drift from the backend's — the charge module exists to prevent exactly that.
 *
 * Unchanged and load-bearing: the id shape is checked before any lookup, the payload is
 * parsed rather than trusted, and a status is derived from the money and the clock
 * (never read off a stored flag).
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

  const source = deps.source ?? chargeSource;
  const directory = deps.directory ?? addressPayeeDirectory;
  const now = deps.now ?? new Date();

  const answer = await source.read(id);

  // The source looked and found nothing: there is no charge with this id.
  if (answer === null) return { kind: 'not-found' };

  // The source CHECKED and the charge must not be paid. Refuse, drawing nothing.
  if (answer.kind === 'refused') return { kind: 'invalid' };

  const stored = parseStoredCharge(answer.payload);

  // A payload that will not parse is refused with the same words as a forged one.
  // Distinguishing them on a public page would tell an attacker which half to fix.
  if (!stored || stored.id !== id) return { kind: 'invalid' };

  const payee = await resolvePayee(directory, stored.recipientAddress);
  const status = resolveChargeStatus(stored, now);

  return { kind: 'charge', charge: toPayCharge(stored), payee, status };
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
