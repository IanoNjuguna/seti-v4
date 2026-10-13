/**
 * The handle namespace, mirrored from `backend/src/services/handle-claims.ts`.
 *
 * Kept as a copy rather than imported: `web/` ships only next/react/react-dom and
 * must not reach into another package's source. If these drift, the backend's
 * round-trip is the contract — `check:handle` and `check:username` pin it.
 *
 * There is ONE identity shape here for a person and a business alike. A username
 * and a business name are the same kind of signed handle; `kind` is only a
 * profile mode, so the pages and the send flow never need two types.
 */

/** Whether a handle belongs to a person or a business — a mode, not an identity. */
export type HandleKind = 'person' | 'business';

/** What a client may be told about a handle. */
export interface HandleIdentity {
  id: string;
  /** The stored, unique handle behind `seti.live/m/<handle>` or `/u/<handle>`. */
  handle: string;
  kind: HandleKind;
  /** The username or the business name. */
  name: string;
  /**
   * The authoritative thing. A name is only ever a label beside this, and the
   * money path must act on the address rather than on the name.
   */
  address: string | null;
  category: string | null;
  /**
   * True only when the backend re-derived a valid signature over THIS name, THIS
   * purpose and THIS address. Never asserted.
   */
  verified: boolean;
  /** The purpose the binding was signed for; null for a pre-purpose backfill. */
  purpose: string | null;
  /**
   * The business profile a business handle turns on — the id the pay flow pays.
   * Null for a person, who has no profile.
   */
  merchantId: string | null;
  claimedAt: string | null;
}

export interface ResolveHandleResult {
  handle: HandleIdentity;
  suggestedAmount: string | null;
}

/** Exactly the fields the person signs, in the order they are shown. */
export interface ClaimHandleRequest {
  kind: HandleKind;
  name: string;
  address: string;
  issuedAt: string;
  nonce: string;
  signature: string;
}

export interface ClaimHandleResult {
  handle: HandleIdentity;
}

/**
 * The handle a name will get, and whether it is free — the backend's answer to
 * the claim form's live preview. Mirrors `HandleStatus` on the backend.
 */
export interface HandleStatusPreview {
  name: string;
  handle: string;
  problem: string | null;
  takenBy: string | null;
}

export interface HandleStatusResult {
  status: HandleStatusPreview;
}
