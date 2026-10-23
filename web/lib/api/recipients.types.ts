/**
 * Somebody this account has already paid — the send screen's repeat entry (#99).
 *
 * Mirrors `RecentRecipient` in `backend/src/types/index.ts`. Kept as a copy rather
 * than imported (the web package must not reach into the backend's source); the
 * shape is the contract, and the route that answers it is `GET /transactions/
 * recipients`.
 */

export interface RecentRecipient {
  /**
   * The name the transfer was made as: a merchant's own signed business name, the
   * handle the customer resolved, or the address shortened for prose. There is no
   * fourth option — a display name is never invented for an address.
   */
  name: string;
  /** The handle to re-resolve, or null when this person was only ever an address. */
  handle: string | null;
  /** The address the money went to. */
  address: string;
  /** When they were last paid, ISO. The server returns the list ordered by it. */
  lastPaidAt: string;
}

export interface RecentRecipientsAnswer {
  recipients: RecentRecipient[];
}
