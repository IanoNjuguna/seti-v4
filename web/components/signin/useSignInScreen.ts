'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useSession } from '@/lib/auth';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { TERMS_VERSION } from '@/lib/legal/terms';
import { resolveSignInStage } from './sign-in-stage';
import type { UseSignInScreenReturn } from './useSignInScreen.types';

/**
 * The sign-in page's whole state machine: which screen is showing, what has been
 * typed, and what each control does.
 *
 * Every action calls the SESSION's own methods and nothing else — the page owns no
 * credential, and `signIn` / `submitSignInCode` never reject, so a failure is a
 * readable reason in `error` rather than a rejection a click handler forgets.
 *
 * ## Consent is carried on both calls, from the app's one version constant
 *
 * Signing in here is also signing UP (the account is created on the first
 * successful verify), so the terms acceptance is not decoration: `TERMS_VERSION` is
 * the same constant the legal pages print their effective date from and the same
 * one the backend records on the account's audit row. The address call and the code
 * call both carry it, because the account can be created by either and a version
 * that reached only one of them is a sign-up nobody can prove was consented to.
 * Blanking that argument is what produced the `acceptedVersion: null` this page
 * exists to fix.
 *
 * The three stage flags are the page's memory of what the person pressed, and they
 * exist because the session cannot answer "which screen is this person on":
 * `sign-in-stage.ts` explains how they combine.
 *
 * `onPreviewSent` is the dev-source-only way to see the sent screen on a build with
 * no Privy app id to send anything with. It is off unless `source === 'dev'`
 * (`previewAvailable`), so a Privy build cannot reach it.
 */
export function useSignInScreen(): UseSignInScreenReturn {
  const { status, signInStatus, source, error, signIn, submitSignInCode } =
    useSession();
  const { accepted, setAccepted } = useTermsAcceptance();
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [pastFirstSend, setPastFirstSend] = useState(false);
  const [dismissedSent, setDismissedSent] = useState(false);
  const [previewSent, setPreviewSent] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const stage = resolveSignInStage({
    status,
    signInStatus,
    source,
    pastFirstSend,
    dismissedSent,
    previewSent,
  });

  const onAddressChange = useCallback((value: string) => setAddress(value), []);
  const onCodeChange = useCallback((value: string) => setCode(value), []);
  const onAcceptChange = useCallback((next: boolean) => setAccepted(next), [setAccepted]);

  /** Mail the code. Also the retry after a send that failed. */
  const onSubmitAddress = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // The button is disabled until the box is ticked; this is the same gate for
      // the other way a form submits (Enter in the field, which browsers block on a
      // disabled default button — but a gate that depends on that is a gate with no
      // test behind it).
      if (!accepted) return;
      setPastFirstSend(false);
      setDismissedSent(false);
      setPreviewSent(false);
      void signIn(address, TERMS_VERSION);
    },
    [signIn, address, accepted]
  );

  /** Consume the code. `verifying` is cleared when the promise settles either way. */
  const onSubmitCode = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPastFirstSend(true);
      setVerifying(true);
      void submitSignInCode(code, TERMS_VERSION).finally(() => setVerifying(false));
    },
    [submitSignInCode, code]
  );

  const onResend = useCallback(() => {
    setPastFirstSend(true);
    void signIn(address, TERMS_VERSION);
  }, [signIn, address]);

  const onUseAnotherAddress = useCallback(() => {
    setCode('');
    setPastFirstSend(false);
    setDismissedSent(true);
    setPreviewSent(false);
  }, []);

  const onPreviewSent = useCallback(() => {
    setDismissedSent(false);
    setPreviewSent(true);
  }, []);

  return {
    stage,
    address,
    code,
    error,
    accepted,
    sending: signInStatus === 'sending',
    verifying,
    previewAvailable: source === 'dev' && address.trim() !== '',
    onAddressChange,
    onCodeChange,
    onAcceptChange,
    onSubmitAddress,
    onSubmitCode,
    onResend,
    onUseAnotherAddress,
    onPreviewSent,
  };
}
