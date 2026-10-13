/**
 * The handle a name will get, and whether it is free — the backend's answer to
 * the claim form's live preview.
 *
 * Mirrors `MerchantHandleStatus` in `backend/src/services/merchant-claims.ts`.
 * Kept as a copy rather than imported (the web ships only next/react/react-dom),
 * with the backend's round-trip as the contract — `check:handle` pins it.
 */
export interface MerchantHandlePreview {
  /** The name as the rule would store it. */
  name: string;
  /** The link's handle for that name — `seti.live/m/<handle>`. */
  handle: string;
  /** A name- or handle-rule failure, or null when the name is usable. */
  problem: string | null;
  /** The merchant already holding this handle, or null when it is free. */
  takenBy: string | null;
}

export interface MerchantHandleStatusResult {
  status: MerchantHandlePreview;
}
