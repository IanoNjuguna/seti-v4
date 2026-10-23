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
 * The address-to-name read, for real charges (#197).
 *
 * A charge names an ADDRESS, so the page cannot look a payee up by handle. It asks the
 * public payee API whether that address is a name a merchant signed for AND a merchant a
 * person at Seti reviewed, and it gets a name back only when BOTH hold plus the claim
 * signature still verifies. Anything less comes back as `name: null` with the handle, and
 * `pay-public.tier.ts` draws the unverified tier. The gate is the backend's, in
 * `backend/src/services/payee-directory.ts`; this file only carries the answer.
 *
 * TWO PROPERTIES ARE THIS FILE'S OWN, and both are anti-forgery rather than transport:
 *
 *  - `name` is the handle when the read has no name to give. `resolvePayee` needs a
 *    non-empty name to keep the handle at all, and `@handle` is what the unverified tier
 *    draws anyway, so nothing is invented: `payeeIdentity` never reads `name` outside the
 *    verified tier. What must NOT happen is a claimed name travelling for an unreviewed
 *    merchant, and the read does not send one.
 *  - no cache. A withdrawn review (`verifiedAt` and `verifiedEvidence` cleared together)
 *    must drop the name on the NEXT render, not at a cache expiry, so this is
 *    `cache: 'no-store'`. A cached name would outlive the review that justified it.
 *
 * An unreachable backend THROWS rather than answering "no name": `resolvePayee` may draw
 * the address tier for an address with no Seti name, never for a backend that is down. A
 * `404` is the one response read as "no name", so a revision that answers that way
 * degrades to the unverified tier instead of a 500.
 */
export function backendPayeeDirectory(baseUrl: string = API_BASE_URL): PayeeDirectory {
  return {
    async findNamedPayee(address: string): Promise<NamedPayee | null> {
      const response = await fetch(`${baseUrl}/public/payees/${encodeURIComponent(address)}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });

      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`payee read failed: ${response.status} ${response.statusText}`);
      }

      const body = (await response.json()) as { payee?: unknown } | null;
      return toNamedPayee(body?.payee);
    },
  };
}

/** The default directory the pay page resolves its recipient through. */
export const addressPayeeDirectory: PayeeDirectory = backendPayeeDirectory();

/**
 * A payee read's answer, narrowed into the shape the page draws.
 *
 * `null` is an answer (no name for this address). An answer that is not a payee is an
 * ERROR: a name is a trust signal, so a payload this app cannot read must not quietly
 * become the unverified tier, which would hide a broken backend behind a true-looking
 * page.
 */
function toNamedPayee(view: unknown): NamedPayee | null {
  if (view === null || view === undefined) return null;
  if (typeof view !== 'object' || Array.isArray(view)) {
    throw new Error('payee read answered something that is not a payee');
  }

  const { handle, name, address, verified, merchantVerifiedAt } = view as Record<string, unknown>;

  if (typeof handle !== 'string' || typeof address !== 'string' || typeof verified !== 'boolean') {
    throw new Error('payee read answered a payee without a handle, an address or a verdict');
  }
  if (name !== null && typeof name !== 'string') {
    throw new Error('payee read answered a name that is neither a string nor null');
  }
  if (merchantVerifiedAt !== null && typeof merchantVerifiedAt !== 'string') {
    throw new Error('payee read answered a review date that is neither a string nor null');
  }

  return {
    handle,
    name: name ?? handle,
    address,
    verified,
    merchantVerifiedAt,
  };
}
