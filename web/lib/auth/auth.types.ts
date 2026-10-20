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

/**
 * The session's THREE states. Signed-out is a state of its own, never the
 * absence of the other one.
 *
 *  - `restoring`  — a stored session exists and is being re-resolved against the
 *                   server, or a connect is in flight. The app renders while
 *                   this is true: a browser must be able to LOOK at the product
 *                   before it is asked to connect a wallet, and a wallet
 *                   extension declining (or a store that never answers) must not
 *                   blank a shell that is only drawing a rail.
 *  - `anonymous`  — nobody. Either there was never a session, or the one the
 *                   browser held did not survive re-resolution. This is an
 *                   explicit state the UI branches on, and it is where EVERY
 *                   failed restore or connect lands — never an error boundary.
 *  - `signed-in`  — the server confirmed who this is. `user` and `token` are
 *                   present and are the SERVER's copy, not the stored one.
 *
 * There is no fourth state and no error state: a failure to restore is not a
 * different kind of session, it is `anonymous` with a reason attached
 * (`SessionValue.error`).
 */
export type AuthStatus = 'restoring' | 'anonymous' | 'signed-in';

/**
 * How far a sign-in attempt has travelled.
 *
 * `AuthStatus` says whether SOMEBODY is signed in; this says what the last
 * attempt got to, which is what the sign-in page needs in order to move from the
 * email field to the "we emailed you a code" state and back. It is deliberately
 * separate from `AuthStatus`: a `sent` code is still an `anonymous` session, and
 * the two must not be conflated or a page will read "sent" as "signed in".
 *
 *  - `idle`    — nothing in flight, and no code outstanding.
 *  - `sending` — the code is being mailed (or a code is being checked).
 *  - `sent`    — the code is out; the page should be collecting it.
 *  - `error`   — the last step failed, and `SessionValue.error` says why.
 */
export type SignInStatus = 'idle' | 'sending' | 'sent' | 'error';

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

export interface SessionValue {
  /** The session's state. Branch on THIS, not on the presence of `user`. */
  status: AuthStatus;
  /** The confirmed account, or null unless `status === 'signed-in'`. */
  user: AuthUser | null;
  /** The bearer token for the confirmed account, or null unless `signed-in`. */
  token: string | null;
  /** Convenience for the common branch. Exactly `status === 'signed-in'`. */
  isAuthenticated: boolean;
  /** Which source this build will use. */
  source: AuthSource;
  /**
   * Why the last restore or sign-in failed, when it did. Never a gate — the
   * session still resolves to `anonymous`, which the UI already knows how to
   * render.
   */
  error: string | null;
  /** True while a sign-in request is in flight, so the button can show it. */
  signingIn: boolean;
  /**
   * Where the email sign-in attempt has got to. The sign-in page reads THIS to
   * decide whether it is showing the email field or collecting the emailed code;
   * it is not a synonym for `status`.
   */
  signInStatus: SignInStatus;
  /**
   * Start signing in — and, on the web, signing UP.
   *
   * `acceptedTermsVersion` is a required argument, not a flag, because the account
   * is created on the first successful verify: the Terms the person accepted are
   * part of the request, and a sign-up that records no version is a sign-up nobody
   * can prove was consented to. The value is the version the caller's own UI
   * displayed and had ticked; it is VALIDATED against the app's one version
   * constant before anything is sent, and a missing or stale value REFUSES the flow
   * loudly (`accepted-terms.ts` explains why the check sits in front of the
   * backend's deliberately tolerant one). What reaches `POST /auth/verify` is the
   * app's own current version, never the caller's string.
   *
   * On the `privy` source this mails a one-time code to `email` and parks the
   * session at `signInStatus: 'sent'`; `submitSignInCode` then finishes the job.
   * The address is required there — the Privy modal is deliberately not the
   * product's front door, so there is nothing to fall back to when it is missing.
   * On the `dev` source the address is ignored: that shortcut has one step.
   *
   * It NEVER rejects. Every failure — a refused address, an unreachable Privy, a
   * missing app id, a stale Terms version — lands in `signInStatus: 'error'` with a
   * plain-language reason on `error`, because a caller that has already returned
   * from its click handler must not be handed a rejection it can forget to catch.
   */
  signIn: (email: string, acceptedTermsVersion: string) => Promise<void>;
  /**
   * The second half of email sign-in: submit the code `signIn(email, version)` mailed.
   *
   * Carries the accepted Terms version for the same reason `signIn` does: the
   * account is created here (on the verify call), so this is the moment a first
   * acceptance is recorded. The value is validated against the app's own constant
   * and the version SENT is that constant, never the caller's string.
   *
   * Kept separate from `signIn` because the flow has two moments a page must be
   * able to draw apart — asking for an address, then asking for the code — and
   * because the SDK's own primitives are two calls (`sendCode`, `loginWithCode`).
   * On success it reads the Privy access token, exchanges it with the backend, and
   * lands the session in `signed-in`.
   *
   * Like `signIn`, it NEVER rejects: a wrong or expired code, or a stale Terms
   * version, is `signInStatus: 'error'` with a reason, not a thrown error.
   */
  submitSignInCode: (code: string, acceptedTermsVersion: string) => Promise<void>;
  /**
   * Start signing in with Google.
   *
   * Returns VOID, deliberately. The Google path is a REDIRECT, not a popup: Privy's
   * headless `initOAuth` resolves when the browser is navigating away, so there is no
   * promise a caller could usefully await, and the sign-in actually completes on the
   * next page load (`privy-oauth-sign-in.ts` explains the marker that survives it). The
   * accepted Terms version is still checked before we leave, so a consent that would be
   * refused is refused here rather than after a round trip to Google.
   *
   * Never rejects: a refused start lands in `signInStatus: 'error'` with a reason.
   */
  signInWithGoogle: (acceptedTermsVersion: string) => void;
  signOut: () => Promise<void>;
}
