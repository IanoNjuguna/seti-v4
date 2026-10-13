import type { AccountIdentity } from '@/lib/api';

/**
 * What the app knows about the signed-in account, once.
 *
 * One provider for the whole `/app` subtree, not per-screen fetches: the gate,
 * the onboarding wizard and the Profile intent switch all read the SAME answer,
 * so a claim that has just landed cannot be `onboarded` in one component and
 * still missing in another. Two independent readers of a derived flag is how the
 * app starts disagreeing with itself about who has finished onboarding.
 */
export interface AccountIdentityValue {
  /** The caller's handles and mode, or null while unknown. */
  identity: AccountIdentity | null;
  /**
   * True only while the FIRST read for the current account is in flight. A
   * refresh keeps the previous answer visible instead of blanking the app.
   */
  loading: boolean;
  /** Why the read failed, when it did. Never a gate — the gate fails closed. */
  error: string | null;
  /** DERIVED by the server from the handles' existence. False until known. */
  onboarded: boolean;
  /** Re-read after a claim or an intent switch. */
  refresh: () => void;
  /** Adopt an answer the server just returned, without a second round trip. */
  apply: (identity: AccountIdentity) => void;
}
