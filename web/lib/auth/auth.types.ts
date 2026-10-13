/**
 * Session shapes, mirroring `mobile/src/contexts/auth.types.ts`.
 *
 * The web app needs one thing mobile does not: a named *source*, because a
 * browser has two ways in and they are not interchangeable. `privy` is the real
 * one (email OTP, same as mobile); `dev` is the local shortcut against
 * `POST /auth/dev`, which only exists when the backend runs with
 * `DEV_BYPASS_AUTH=true` and `NODE_ENV=development`.
 */
export type AuthSource = 'privy' | 'dev';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

export interface SessionValue {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /** Which source this build will use. */
  source: AuthSource;
  /** Human-readable reason the last sign-in attempt failed. */
  error: string | null;
  /** True while a sign-in request is in flight, so the button can show it. */
  signingIn: boolean;
  signIn: () => Promise<void>;
  /**
   * Adopt a session that a source has already verified itself.
   *
   * The Privy path produces its own token in the browser (the SDK holds it), so
   * the provider cannot fetch it — the caller exchanges it and hands back the
   * result to be persisted. Keeps `PrivyProvider` out of this module, which must
   * work with no Privy app configured at all.
   */
  signInWithSession: (session: { user: AuthUser; token: string }) => void;
  signOut: () => Promise<void>;
}
