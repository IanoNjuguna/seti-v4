import type { HandleIdentity } from './handles.types';
import type { LiveReadiness, Network } from '@/lib/network';

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
  /**
   * Every handle the account holds ON ITS ACTING NETWORK. Scoped by the backend,
   * so a practice name and a live name never appear in one list.
   */
  handles: HandleIdentity[];
  /** True when at least one handle exists. The gate the app routes on. */
  onboarded: boolean;
  /**
   * The network the account is acting on — decided by the SERVER, never by the
   * client. `testnet` is Practice, `mainnet` is Live.
   */
  network: Network;
  /** The network's product word: Practice | Live. */
  networkLabel: string;
  /** Whether this deployment can move live money, and the reason it cannot. */
  live: LiveReadiness;
  /**
   * The account's live deposit address, or null when none is registered yet.
   *
   * v1 has no on-ramp, so a live account starts EMPTY: the Live side shows this
   * address with a plain "fund this from another wallet" note.
   */
  depositAddress: string | null;
}

/**
 * Where money arrives for this account, from `GET /account/deposit`.
 *
 * The network travels WITH the address because the address alone is not the whole
 * answer: an EVM address is one identifier that exists on every chain, so what a
 * sender has to be told is WHICH CHAIN to send on — and which network view the
 * deposit then appears in. `network` here is the network the DEPLOYMENT serves,
 * decided by the server and never by a request, and `chainId` is that network's, so
 * a wallet can be told which chain the code is for.
 *
 * `address` is null when the account has no active wallet row on that network,
 * which is a real answer rather than an error — this deployment's own table holds
 * mainnet rows for accounts that have signed in since the switch and none for the
 * ones that have not.
 */
export interface DepositTarget {
  network: Network;
  /** The network's product word: Practice | Live. */
  networkLabel: string;
  chainId: number;
  address: string | null;
}
