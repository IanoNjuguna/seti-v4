'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { setAuthToken } from '@/lib/api';
import { TERMS_VERSION } from '@/lib/legal/terms';
import { checkAcceptedTermsVersion } from './accepted-terms';
import {
  describeDevSignInFailure,
  describePrivySignInFailure,
  resolveAuthSource,
} from './auth.constants';
import { clearStoredSession, persistSession } from './auth.storage';
import { usePrivyEmailSignIn } from './privy-email-sign-in';
import { usePrivyOAuthSignIn } from './privy-oauth-sign-in';
import { bootstrapStoredSession } from './session-bootstrap';
import { describeStoredSessionFailure } from './session-identity';
import { devSignIn, privySignIn } from './session';
import type { AuthStatus, AuthUser, SessionValue, SignInStatus } from './auth.types';

/**
 * The session as a state MACHINE, not a bag of nullable fields.
 *
 * `status` is the discriminant, so `user` and `token` cannot be read unless the
 * state is `signed-in` — and `anonymous` is a state of its own that every failed
 * restore lands in, rather than an error left for a boundary to catch.
 */
type SessionState =
  | { status: 'restoring' }
  | { status: 'anonymous'; error: string | null }
  | { status: 'signed-in'; user: AuthUser; token: string };

const RESTORING: SessionState = { status: 'restoring' };

const SessionContext = createContext<SessionValue | null>(null);

/**
 * The web counterpart of `mobile/src/contexts/AuthContext.tsx`.
 *
 * Same shape and same backend endpoints, plus a named source, because a browser
 * has two ways in:
 *
 *  - `dev`   — `POST /auth/dev`, which the backend only serves with
 *              `DEV_BYPASS_AUTH=true` and `NODE_ENV=development`.
 *  - `privy` — the product path: a one-time code mailed to the address the person
 *              typed, then the Privy access token exchanged at `POST /auth/verify`.
 *              Requires `NEXT_PUBLIC_PRIVY_APP_ID` and the `@privy-io/react-auth`
 *              provider.
 *
 * ## Email sign-in is two calls, and both end in a state
 *
 * `signIn(email, version)` mails the code; `submitSignInCode(code, version)`
 * consumes it and exchanges the Privy token for a Seti session. Both take the
 * accepted Terms version because signing in here is also signing up: the account
 * is created on the verify call, and a sign-up with no version on record is one
 * nobody can prove was consented to. They are separate methods because
 * they are two moments the sign-in page draws differently, and because Privy's own
 * primitives are two calls (`useLoginWithEmail`'s `sendCode` / `loginWithCode` —
 * see `privy-email-sign-in.ts`). What the page switches on is `signInStatus`,
 * which is NOT `status`: a mailed code leaves the session `anonymous` and the
 * attempt `sent` at the same time.
 *
 * Neither method rejects. A refused address, an unreachable Privy, a wrong code
 * and a missing app id all land in `signInStatus: 'error'` with a readable reason
 * on `error` — the same place a failed restore puts its own reason, so there is
 * one field a surface reads and no rejection for a click handler to forget.
 *
 * The exchange happens HERE rather than in a component on purpose. The headless
 * flow's whole point is that Seti's own page is the front door, so no Privy
 * component need be mounted at all: `/signin` is the one way in, and it reaches
 * the SDK through this provider rather than a Privy modal.
 *
 * The session is RE-RESOLVED on every load, not read from storage as a fact. The
 * browser keeps a token and a user it remembers, but a remembered identity is not
 * proof of anything — it can be stale, or edited to name an account the token does
 * not own. So `bootstrapStoredSession()` presents the token to `GET /auth/me` and
 * adopts only what the server answers with; a token the server refuses, or an
 * answer that names a different account than the stored user claimed, clears the
 * stored pair and leaves the app anonymous. See `session-bootstrap.ts`.
 *
 * ## A failed restore is `anonymous`, never a crash
 *
 * This is the invariant the whole feature exists for. Restoring may involve a
 * wallet extension (`Failed to connect to MetaMask`), a store that refuses to
 * answer, or an API that is simply down — and every one of those is the same
 * event to the app: nobody is signed in. Each path below is terminated: the
 * bootstrap promise is caught into `anonymous`, and nothing rejects out of the
 * effect. The app shell therefore renders through a restore failure instead of
 * being unmounted by one.
 *
 * `restoring` is the FIRST state and it does not block: it is a real state the
 * shell can render with, so nothing waits on a wallet before drawing.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(RESTORING);
  const [signingIn, setSigningIn] = useState(false);
  const [signInStatus, setSignInStatus] = useState<SignInStatus>('idle');
  const privyEmail = usePrivyEmailSignIn();
  const privyOauth = usePrivyOAuthSignIn();
  const { source, configured } = useMemo(() => resolveAuthSource(), []);

  // State is written only from the promise callback, never synchronously in the
  // effect body: `react-hooks/set-state-in-effect` is an error in this package.
  useEffect(() => {
    let active = true;

    // The `catch` is not decoration. `bootstrapStoredSession` already fails
    // closed, but it is still a promise wrapping a network call and a storage
    // read, and an unexpected rejection anywhere in the chain must land in the
    // same place as an expected one — `anonymous`. There is no state this effect
    // can leave a rejection to.
    void bootstrapStoredSession()
      .then(async (outcome): Promise<SessionState> => {
        if (outcome.kind === 'restored') {
          // Persist the SERVER's copy, not the one that was there at load: the
          // snapshot is refreshed from the confirmed answer every time.
          persistSession({ user: outcome.user, token: outcome.token });
          return { status: 'signed-in', user: outcome.user, token: outcome.token };
        }

        // A Google login does not resolve in a click handler, it resolves HERE.
        // Privy's headless `initOAuth` redirects, so the browser comes back as a new
        // document with no Seti token stored: this branch is the only place the
        // exchange can happen, and the marker is what says a login is waiting.
        //
        // The marker is cleared before the exchange: a token that never arrives must
        // not leave the next page load retrying a session nobody started.
        if (privyOauth.hasPendingReturn()) {
          privyOauth.clearReturn();
          try {
            const token = await privyEmail.accessToken();
            if (!token) {
              throw new Error('Privy returned from Google with no access token.');
            }

            const { user, token: sessionToken } = await privySignIn(
              token,
              privyEmail.walletAddress(),
              TERMS_VERSION
            );
            persistSession({ user, token: sessionToken });
            setAuthToken(sessionToken);
            return { status: 'signed-in', user, token: sessionToken };
          } catch (cause) {
            // A cancelled Google screen usually arrives as no token at all, and the
            // customer is back on a front door they recognise. The sentence names the
            // step rather than blaming the account.
            return { status: 'anonymous', error: describePrivySignInFailure(cause) };
          }
        }

        // A rejected pair is reported, because being signed out with no explanation
        // is indistinguishable from a broken app. A first visit (`anonymous`) is
        // silent — there was never a session to lose.
        return {
          status: 'anonymous',
          error: outcome.kind === 'rejected' ? outcome.error : null,
        };
      })
      .catch((cause: unknown): SessionState => ({
        status: 'anonymous',
        error: describeStoredSessionFailure(cause),
      }))
      .then((next) => {
        if (active) setState(next);
      });

    return () => {
      active = false;
    };
  }, [privyEmail, privyOauth]);

  /**
   * Land a failed step of the Privy flow.
   *
   * Both halves of email sign-in fail into the same two fields: `error`, which
   * every renderer already shows, and `signInStatus: 'error'`, which is what the
   * sign-in page switches on. A signed-in session is never downgraded by a later
   * failed attempt — pressing sign-in again must not sign anybody out.
   */
  const failPrivySignIn = useCallback((message: string) => {
    setSignInStatus('error');
    setState((previous) =>
      previous.status === 'signed-in' ? previous : { status: 'anonymous', error: message }
    );
  }, []);

  /**
   * Begin email sign-in: mail the one-time code.
   *
   * The Privy MODAL is deliberately not used here — Seti's own page is the front
   * door — so this is the SDK's headless `sendCode`, and the page learns that it
   * is time to collect the code from `signInStatus === 'sent'`.
   *
   * ## The Terms version is settled before any request goes out
   *
   * `checkAcceptedTermsVersion` runs FIRST, on both sources, and a version that is
   * absent or not the one in force refuses the attempt outright with a sentence on
   * `error`. The account is created by the verify call this flow ends in, so the
   * acceptance must be established before that call is reachable: the version is
   * not a field to default, and the backend's tolerance of an absent one is the
   * exact defect this check stands in front of (`accepted-terms.ts`).
   *
   * This NEVER rejects. The `catch` is not decoration: a caller that has already
   * left its click handler has nowhere to put a rejection, and an unhandled one
   * is how a failed connect blanked a page before.
   */
  const signIn = useCallback(
    async (email: string, acceptedTermsVersion: string) => {
      const refusal = checkAcceptedTermsVersion(acceptedTermsVersion);
      if (refusal) {
        failPrivySignIn(refusal);
        return;
      }

      if (source !== 'privy') {
        // The dev shortcut is unchanged: one call, straight to a session.
        try {
          setSigningIn(true);
          const { user, token } = await devSignIn();
          persistSession({ user, token });
          setAuthToken(token);
          setState({ status: 'signed-in', user, token });
        } catch (error) {
          // A refused sign-in is `anonymous` with a reason — never a rejection,
          // and never a state the UI has no branch for.
          setState({ status: 'anonymous', error: describeDevSignInFailure(error) });
        } finally {
          setSigningIn(false);
        }
        return;
      }

      if (!configured) {
        failPrivySignIn('Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign-in.');
        return;
      }

      const address = email.trim();
      if (!address) {
        // There is nothing to fall back to: the modal is not the product's front
        // door, so an address is required to start the flow at all.
        failPrivySignIn('Enter your email address to continue.');
        return;
      }

      setSignInStatus('sending');
      try {
        await privyEmail.sendCode(address);
        setSignInStatus('sent');
      } catch (cause) {
        failPrivySignIn(describePrivySignInFailure(cause));
      }
    },
    [source, configured, privyEmail, failPrivySignIn]
  );

  /**
   * Finish email sign-in: submit the code, then exchange Privy's token.
   *
   * The exchange lives here rather than in a component because the headless flow
   * may render no Privy component at all. See `session.ts` for why the Privy
   * access token IS the Seti token — there is no second credential to fetch.
   *
   * ## The Terms version is validated here and SENT from here
   *
   * The account is created by the verify call this method ends in, so this is the
   * moment a first acceptance is recorded. The caller's value is only a claim about
   * what it displayed: it is checked against the one version in force, and the
   * string handed to the exchange is `TERMS_VERSION` — the app's own constant —
   * never the caller's string. A stale value refuses the attempt instead of letting
   * the backend record a version nobody was shown.
   *
   * `signInStatus` stays `sent` while the code is being checked: the SDK's own
   * status enum has no "verifying", and the page is already drawing the code
   * field for that state.
   *
   * ## A refused code is said in this flow's own words
   *
   * Consuming the code and exchanging the token are two separate `try` blocks on
   * purpose: a code the SDK refuses names the CODE ("check it and try again, or send
   * a new code"), because that is what the person can act on and both controls are
   * already on the screen, while a failure of the token read or the exchange keeps
   * its own mapping. Neither branch returns the vendor's wording.
   *
   * Like `signIn`, this NEVER rejects.
   */
  const submitSignInCode = useCallback(
    async (code: string, acceptedTermsVersion: string) => {
      const refusal = checkAcceptedTermsVersion(acceptedTermsVersion);
      if (refusal) {
        failPrivySignIn(refusal);
        return;
      }

      if (source !== 'privy') {
        failPrivySignIn('This build signs in directly, without an emailed code.');
        return;
      }

      if (!configured) {
        failPrivySignIn('Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign-in.');
        return;
      }

      const entered = (code ?? '').trim();
      if (!entered) {
        failPrivySignIn('Enter the code we emailed you to continue.');
        return;
      }

      try {
        await privyEmail.submitCode(entered);
      } catch (cause) {
        // The CODE was refused — mistyped, expired, or already used. It is the one
        // failure of this flow that is about the code rather than the session, so it
        // is named as such. The retry is not a button rendered by this message: the
        // code field, the submit button and "send a new code" are all already on the
        // screen under it.
        failPrivySignIn(describePrivySignInFailure(cause, 'code'));
        return;
      }

      try {
        // Privy reports `authenticated` slightly before the token is readable, so
        // this read polls rather than asking once and giving up.
        const token = await privyEmail.accessToken();
        if (!token) {
          throw new Error('Privy signed in but never returned an access token.');
        }

        // The wallet is not an identity claim: the server checks the address
        // against Privy's own wallet list before registering it. It can be absent
        // right after a first sign-in, while the embedded wallet is still being
        // created — the server then falls back to Privy's own view.
        const { user, token: sessionToken } = await privySignIn(
          token,
          privyEmail.walletAddress(),
          TERMS_VERSION
        );
        persistSession({ user, token: sessionToken });
        setAuthToken(sessionToken);
        setState({ status: 'signed-in', user, token: sessionToken });
        setSignInStatus('idle');
      } catch (cause) {
        failPrivySignIn(describePrivySignInFailure(cause));
      }
    },
    [source, configured, privyEmail, failPrivySignIn]
  );

  /**
   * Begin Google sign-in.
   *
   * This method ENDS EARLY ON PURPOSE: the browser is about to leave for Google, so
   * there is nothing here to await. What completes the sign-in is the boot effect
   * above, on the page load Google sends back. Sending the terms version here would
   * be pointless for the same reason (it is carried on the verify call, which runs
   * after the return), but the consent is still checked before we leave, so a customer
   * who has not accepted cannot start a sign-up that would be refused later.
   */
  const signInWithGoogle = useCallback(
    (acceptedTermsVersion: string) => {
      const refusal = checkAcceptedTermsVersion(acceptedTermsVersion);
      if (refusal) {
        failPrivySignIn(refusal);
        return;
      }

      if (source !== 'privy') {
        failPrivySignIn('Google sign-in is not available in this build.');
        return;
      }

      if (!configured) {
        failPrivySignIn('Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign-in.');
        return;
      }

      setSignInStatus('sending');
      void privyOauth.startGoogleLogin().catch((cause: unknown) => {
        failPrivySignIn(describePrivySignInFailure(cause));
      });
    },
    [source, configured, privyOauth, failPrivySignIn]
  );

  const signOut = useCallback(async () => {
    clearStoredSession();
    setAuthToken(null);
    // An outstanding code belongs to the session that just ended; leaving the
    // page on `sent` would ask the next person for a code that is not theirs.
    setSignInStatus('idle');
    setState({ status: 'anonymous', error: null });
  }, []);

  const value = useMemo<SessionValue>(() => {
    const status: AuthStatus = state.status;

    return {
      status,
      user: state.status === 'signed-in' ? state.user : null,
      token: state.status === 'signed-in' ? state.token : null,
      isAuthenticated: state.status === 'signed-in',
      source,
      error: state.status === 'anonymous' ? state.error : null,
      signingIn,
      signInStatus,
      signIn,
      submitSignInCode,
      signInWithGoogle,
      signOut,
    };
  }, [
    state,
    source,
    signingIn,
    signInStatus,
    signIn,
    submitSignInCode,
    signInWithGoogle,
    signOut,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
