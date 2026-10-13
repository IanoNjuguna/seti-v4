import type { HandleIdentity } from './handles.types';

/**
 * The mode an account acts as: `personal` or `business`.
 *
 * Deliberately NOT `HandleKind` (`person` | `business`), and the one-letter
 * difference is the point. The KIND belongs to a HANDLE — what a name was claimed
 * as, which decides the `purpose` inside the signature. The INTENT belongs to the
 * ACCOUNT — which mode it presents as. An account can hold a `person` handle AND a
 * `business` handle at once (try it personal, add a business later), so the mode
 * cannot be read off the handles without making one of them win forever.
 *
 * The two are bridged by one map, `HANDLE_KIND_FOR_INTENT` in
 * `web/lib/account/account.constants.ts`. Mirrors `AccountIntent` in
 * `backend/src/services/account.ts`.
 */
export type AccountIntent = 'personal' | 'business';

/**
 * The caller's handles and mode, from `GET /account`.
 *
 * `onboarded` is DERIVED by the backend from the handles' existence — not a stored
 * flag, and the app never computes it itself. One rule, one place: any client that
 * re-derived it would be a second answer that can disagree.
 */
export interface AccountIdentity {
  /** The active mode. Never a gate — an intent with no handle is still not onboarded. */
  intent: AccountIntent;
  /** Every handle the account holds, a person's username and a business's name alike. */
  handles: HandleIdentity[];
  /** True when at least one handle exists. The gate the app routes on. */
  onboarded: boolean;
}
