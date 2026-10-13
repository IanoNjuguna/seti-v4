/**
 * Merchant name claim types, mirrored from
 * `backend/src/services/merchant-claims.ts`.
 *
 * Kept as a copy rather than imported: `web/` ships only next/react/react-dom
 * and must not reach into another package's source. If these drift, the
 * backend's round-trip is the contract — the check suite
 * (`backend/src/services/merchant-claims.check.ts`) is what pins it.
 */

/** A merchant as the resolve/claim endpoints report it. */
export interface ClaimedMerchant {
  id: string;
  name: string;
  /**
   * The stored, unique handle behind `seti.live/m/<handle>`. The backend
   * computes and stores it, and refuses a claim whose handle another merchant
   * holds, so this is the one thing a handle is resolved by. Null only for a row
   * that predates claims.
   */
  handle: string | null;
  category: string | null;
  /**
   * The authoritative thing. A name is only ever a label beside this, and the
   * money path must act on the address rather than on the name.
   */
  payoutAddress: string | null;
  /**
   * True only when the backend re-derived a valid signature over THIS name and
   * THIS address. Never asserted: a name with no signature behind it, or one
   * whose row was tampered with, comes back false.
   */
  verified: boolean;
  /** When the claim was accepted, ISO 8601, or null when there is no claim. */
  claimedAt: string | null;
}

/** Exactly the fields the person signs, in the order they are shown. */
export interface ClaimMerchantNameRequest {
  name: string;
  address: string;
  issuedAt: string;
  nonce: string;
  signature: string;
}

export interface ClaimMerchantNameResult {
  merchant: ClaimedMerchant;
}
