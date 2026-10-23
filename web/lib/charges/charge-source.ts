import { API_BASE_URL } from '../api/api.constants';
import type { ChargeSource, NamedPayee, PayeeDirectory } from './charge.types';

/**
 * THE REAL CHARGE SOURCE. This file replaces the fixture seam (#131).
 *
 * The pay page is a server component, so this runs on the server (Node in dev, the
 * Cloudflare Worker in production) and talks to the Seti API — it is not a browser
 * call, and no session is involved: `GET /public/charges/:id` is public because a
 * payment request has to be readable by someone with no Seti account.
 *
 * ## Why the page does not verify the signature itself
 *
 * The charge is signed EIP-712 by the recipient's wallet, and the backend re-verifies
 * that signature from the stored bytes on every read (`charge-store.ts`
 * `loadChargeView`). A Next app cannot do the same check without the key material and
 * the chain, and re-implementing it here would give the product a SECOND verifier —
 * the thing the whole charge module exists to prevent. So the seam's answer is
 * authoritative in both directions:
 *
 *   - `404` → there is no such charge (`not-found`), the page's 404.
 *   - `422 charge-signature-invalid` → the charge exists and must NOT be paid. That is
 *     the page's refusal, NOT a 404: "there is nothing here" is an untrue statement
 *     about a request that exists, and a payer has to be told not to pay it.
 *   - any other failure → THROWS. A backend that is down must never read to a stranger
 *     as "no charge here"; the route's error boundary says something is wrong.
 *
 * ## The unit on the page
 *
 * A charge's `amount` is a decimal string in TOKEN units, and that is the unit the
 * page shows (`USD`). It is not a refusal to show KES — it is the absence of a
 * second money model: the charge carries no fiat figure, the signature covers token
 * units, and converting here would price a payment with a rate nobody signed. When
 * Seti denominates a charge in KES, the figure has to arrive ON the charge.
 */
export const CHARGE_DISPLAY_CURRENCY = 'USD';

/** The API's charge, as the page's stored payload. `charge.validate.ts` is the gate. */
function toStoredCharge(raw: unknown): unknown {
  const body = raw as { charge?: Record<string, unknown> } | null;
  const view = body?.charge;
  if (!view || typeof view !== 'object') return null;

  const memo = typeof view.memo === 'string' && view.memo.trim() !== '' ? view.memo : null;

  return {
    id: view.id,
    currency: CHARGE_DISPLAY_CURRENCY,
    // `Number("100.000000")` is 100 — the page's amounts are plain numbers, and the
    // string shape is the API's, so the conversion happens exactly here.
    amount: typeof view.amount === 'string' ? Number(view.amount) : NaN,
    received: typeof view.received === 'string' ? Number(view.received) : 0,
    recipientAddress: view.recipient,
    memo,
    expiresAt: view.expiresAt ?? null,
    paidAt: view.settledAt ?? null,
    // A charge has no receipt: Seti holds nothing and issues none (#131 non-goal).
    // The key is present and null so the page's shape is unchanged.
    receiptPath: null,
    signature: view.signature,
  };
}

/** A charge source backed by the public charge API. */
export function backendChargeSource(baseUrl: string = API_BASE_URL): ChargeSource {
  return {
    async read(id) {
      const response = await fetch(`${baseUrl}/public/charges/${encodeURIComponent(id)}`, {
        headers: { accept: 'application/json' },
        // The status is decided at request time, so a cached answer would keep
        // offering a code for a request that has been paid or has run out.
        cache: 'no-store',
      });

      if (response.status === 404) return null;
      if (response.status === 422) return { kind: 'refused' };
      if (!response.ok) {
        throw new Error(`charge read failed: ${response.status} ${response.statusText}`);
      }

      return { kind: 'found', payload: toStoredCharge(await response.json()) };
    },
  };
}

/** The default source the pay page reads through. */
export const chargeSource: ChargeSource = backendChargeSource();

/**
 * The address-to-name lookup, for real charges.
 *
 * It answers "no name", and that is the honest answer rather than a stub to be
 * ashamed of: `backend/src/lib/payee.ts` states that an address cannot be resolved
 * back to a name — a handle is looked up BY its string, which is why the page shows
 * the address with a label saying it has no Seti name. Inventing a name here (or
 * lifting one out of the query) is the exact anti-pattern the page was built against.
 *
 * WHAT A REAL READ MUST ANSWER (#154). When a lookups-by-address read exists, this
 * object is replaced and the interface does not change — but the replacement has to
 * report BOTH halves of a name: `verified` (the claim signature holds, recomputed by
 * the backend) and `merchantVerifiedAt` (when a person approved the merchant record,
 * `merchants."verifiedAt"`, null when nobody has). The pay page's verified tier needs
 * both, so a read that omits the review date leaves every page in the unverified tier.
 * Until that read exists, every live page IS the unverified tier: the rollback state,
 * with the address, our facilitated-by line and the charge id on it.
 */
export const addressPayeeDirectory: PayeeDirectory = {
  // No parameter: this directory answers "no name" for every address, and an unused
  // argument would read as a lookup that might sometimes succeed.
  async findNamedPayee(): Promise<NamedPayee | null> {
    return null;
  },
};
