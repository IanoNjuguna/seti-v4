'use client';

/**
 * Seti's own email sign-in, in Privy's words.
 *
 * Privy offers exactly two headless email primitives and Seti's page uses both:
 * `sendCode({ email })` mails the one-time passcode, and `loginWithCode({ code })`
 * consumes it. Verified against the shipped types of `@privy-io/react-auth`
 * 3.48.1 (`dist/dts/index.d.ts`): `useLoginWithEmail` returns
 * `{ sendCode, loginWithCode, state }`.
 *
 * There is no headless magic-LINK login in this SDK. `useLoginWithEmail` is the
 * OTP flow, and the only link-shaped method — `useLinkEmail({ email })` — attaches
 * an email to a user who is ALREADY authenticated. So "magic link" here means the
 * emailed one-time code, entered back into Seti's own page.
 *
 * ## Why the implementation is chosen at module scope
 *
 * `useLoginWithEmail`, `usePrivy` and `useWallets` all throw when no
 * `PrivyProvider` is above them, and this app is expected to run with NO Privy app
 * configured (the `dev` source). `PRIVY_APP_ID` is fixed for a build, so exactly
 * one implementation is ever selected and hook order is identical on every render
 * — the same reason `hooks/useEmbeddedWallet.ts` is written this way, and the
 * reason `react-hooks/rules-of-hooks` stays satisfied.
 *
 * ## Why the token and the wallet are read through refs
 *
 * `submitCode` resolves as Privy flips its internal state, and the caller needs
 * the token and the signing wallet AT THAT MOMENT, not as they were captured when
 * the render that produced the callback began. The refs hold the current values;
 * the callbacks stay referentially stable so the session provider is not rebuilt
 * on every render.
 */

import { useCreateWallet, useLoginWithEmail, usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { readPrivyAccessToken } from './privy-access-token';

/**
 * The Privy-touching half of email sign-in, as the session provider consumes it.
 *
 * Every method REJECTS on failure and none of them writes any state: the policy
 * (what a failure looks like to a person, and which session state it lands in)
 * stays in `SessionProvider`. This file only speaks Privy.
 */
export interface PrivyEmailSignIn {
  /** Mail the one-time passcode. Resolves once Privy has sent it. */
  sendCode: (email: string) => Promise<void>;
  /**
   * Consume the passcode. Resolves once Privy has authenticated the user AND the
   * account has an embedded wallet to sign with.
   */
  submitCode: (code: string) => Promise<void>;
  /** The authenticated access token, polled briefly for the post-login race. */
  accessToken: () => Promise<string | null>;
  /** The embedded wallet the browser will sign with, or undefined before it exists. */
  walletAddress: () => string | undefined;
}

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

function usePrivyEmailSignInImpl(): PrivyEmailSignIn {
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { getAccessToken, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();

  /**
   * The address of a wallet created on THIS login, before React has re-rendered
   * with it. Privy resolves `createWallet()` with the wallet, but `useWallets()`
   * only catches up on the next render, and the session is verified in the same
   * tick — so the ref is what lets `walletAddress()` name it on that call.
   */
  const createdAddressRef = useRef<string | null>(null);

  const authenticatedRef = useRef(authenticated);
  useEffect(() => {
    authenticatedRef.current = authenticated;
  }, [authenticated]);

  const walletsRef = useRef(wallets);
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  const send = useCallback((email: string) => sendCode({ email }), [sendCode]);

  /**
   * Ensure the account has an embedded wallet before the session is verified.
   *
   * Privy authenticates an email-only account and leaves it with NO wallet, which
   * is what `createOnLogin: 'users-without-wallets'` is supposed to prevent — but
   * that setting works by PROMPTING on Privy's own UI, and this app signs in
   * headless with its own page and its own code field. Nothing ever prompts, so
   * nothing was ever created: the login succeeded, the account had no wallet, and
   * `/auth/verify` refused it (production, 2026-10-18, did:privy:cmvdyfweg…).
   *
   * Creating it here rather than on the backend is deliberate: the browser has to
   * hold the key, and `wallet-registry.ts` records what minting wallets server-side
   * cost — a second wallet nobody could spend from.
   *
   * ## A failure is no longer swallowed (#226)
   *
   * It used to be, and the reason is worth keeping in view: the verify that follows
   * answers with the sentence a customer can act on, and failing the login here
   * would replace it with a generic error. That argument holds for the SENTENCE and
   * not for the EVIDENCE — so the sentence still comes from verify, and the cause is
   * now written down once. Before this, creation could fail and the console said
   * nothing at all, which is how a person looped back through the same code field
   * with no artefact anywhere to say why.
   *
   * The wallet this creates is still only reachable here for the moment of sign-in;
   * from then on the app resolves the account's own registered address instead
   * (`lib/auth/account-wallet.ts`), so nothing depends on this ref surviving.
   */
  const ensureEmbeddedWallet = useCallback(async (): Promise<void> => {
    const existing = walletsRef.current.find((wallet) => wallet.walletClientType === 'privy');
    if (existing) return;

    try {
      const wallet = await createWallet();
      createdAddressRef.current = wallet.address;
    } catch (error) {
      // Once, and with the cause: a create that fails leaves the account walletless
      // on this device, and the log line is the only record of why.
      console.error(
        '[auth] could not create an embedded wallet during sign-in:',
        (error as Error | null)?.message ?? error
      );
    }
  }, [createWallet]);

  const submit = useCallback(
    async (code: string) => {
      await loginWithCode({ code });
      await ensureEmbeddedWallet();
    },
    [loginWithCode, ensureEmbeddedWallet]
  );

  const accessToken = useCallback(
    () => readPrivyAccessToken(getAccessToken, () => authenticatedRef.current),
    [getAccessToken]
  );

  const walletAddress = useCallback(
    () =>
      (walletsRef.current.find((wallet) => wallet.walletClientType === 'privy') ??
        walletsRef.current[0])?.address ?? createdAddressRef.current ?? undefined,
    []
  );

  return useMemo(
    () => ({ sendCode: send, submitCode: submit, accessToken, walletAddress }),
    [send, submit, accessToken, walletAddress]
  );
}

/**
 * The no-Privy stand-in.
 *
 * Nothing here can sign anybody in, and it says so by rejecting, so a caller that
 * reaches it by mistake lands in the provider's `error` state instead of at a
 * `usePrivy`-has-no-provider crash — the failure mode this app's whole session
 * design exists to avoid.
 */
function useNoPrivyEmailSignIn(): PrivyEmailSignIn {
  const unavailable = useCallback(
    (): Promise<void> =>
      Promise.reject(new Error('Privy is not configured: NEXT_PUBLIC_PRIVY_APP_ID is not set.')),
    []
  );

  const noToken = useCallback(async () => null, []);
  const noWallet = useCallback((): string | undefined => undefined, []);

  return useMemo(
    () => ({
      sendCode: unavailable,
      submitCode: unavailable,
      accessToken: noToken,
      walletAddress: noWallet,
    }),
    [unavailable, noToken, noWallet]
  );
}

export const usePrivyEmailSignIn: () => PrivyEmailSignIn = PRIVY_APP_ID
  ? usePrivyEmailSignInImpl
  : useNoPrivyEmailSignIn;
