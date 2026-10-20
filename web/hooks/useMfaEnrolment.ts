'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useLinkWithPasskey,
  useMfaEnrollment,
  usePrivy,
  type LinkedAccountWithMetadata,
} from '@privy-io/react-auth';
import { PRIVY_APP_ID } from '@/components/providers/PrivyAppProvider.constants';
import { passkeyCredentialIds } from '@/lib/mfa/mfa';
import { MFA_ENROL_COPY } from '@/lib/mfa/mfa.constants';
import type { MfaEnrolStep, MfaEnrolmentValue, MfaTotpMaterial } from './useMfaEnrolment.types';

/**
 * How long to wait for Privy to report the passkey the device just created.
 *
 * `linkWithPasskey()` resolves `void` and `PasskeyFlowState` never names the
 * credential, so the only record of the new passkey is the user object — and that
 * arrives on the next render, not on the resolution. Polling that object is the same
 * race `readPrivyAccessToken` handles for the access token, and the same bound is
 * used here: ~1.8s, then the customer is told to try again rather than left waiting.
 */
const PASSKEY_POLL_ATTEMPTS = 12;
const PASSKEY_POLL_MS = 150;

/**
 * The two enrolment paths, owned in one hook so the panel holds no state.
 *
 * Every method rejects nothing: a failure becomes `error`, which the panel renders
 * beside the control the person just used. The caller (`MfaEnrolPanel`) is a click
 * handler chain, and a rejected promise there is a console line nobody sees.
 *
 * `onEnrolled` fires only after Privy has confirmed the method, and it is what makes
 * the money step appear immediately instead of after Privy's own state update.
 */
function useMfaEnrolmentImpl(onEnrolled: () => void): MfaEnrolmentValue {
  const { user } = usePrivy();
  const { linkWithPasskey } = useLinkWithPasskey();
  const {
    initEnrollmentWithPasskey,
    submitEnrollmentWithPasskey,
    initEnrollmentWithTotp,
    submitEnrollmentWithTotp,
  } = useMfaEnrollment();

  const [step, setStep] = useState<MfaEnrolStep>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totp, setTotp] = useState<MfaTotpMaterial | null>(null);
  const [code, setCode] = useState('');

  // The user object as of the LATEST render. After a link, the closure's copy is
  // stale by one render and the new credential is only in here.
  const accountsRef = useRef<readonly LinkedAccountWithMetadata[] | undefined>(user?.linkedAccounts);
  useEffect(() => {
    accountsRef.current = user?.linkedAccounts;
  }, [user]);

  /** The credential IDs, waiting briefly for a passkey this device has just created. */
  const waitForPasskeys = useCallback(async (): Promise<string[]> => {
    for (let attempt = 0; attempt < PASSKEY_POLL_ATTEMPTS; attempt += 1) {
      const ids = passkeyCredentialIds(accountsRef.current);
      if (ids.length > 0) return ids;
      await new Promise((resolve) => setTimeout(resolve, PASSKEY_POLL_MS));
    }
    return [];
  }, []);

  const choosePasskey = useCallback(() => {
    setError(null);
    setStep('passkey');
    setBusy(true);

    void (async () => {
      try {
        // A passkey has to EXIST on the account before it can be an MFA method, and
        // an account that signed up with an emailed code has none.
        const existing = passkeyCredentialIds(accountsRef.current);
        if (existing.length === 0) await linkWithPasskey();

        const credentialIds = existing.length > 0 ? existing : await waitForPasskeys();
        if (credentialIds.length === 0) throw new Error('no passkey after linking');

        await initEnrollmentWithPasskey();
        await submitEnrollmentWithPasskey({ credentialIds });
        onEnrolled();
      } catch {
        setError(MFA_ENROL_COPY.errors.passkey);
        setStep('choose');
      } finally {
        setBusy(false);
      }
    })();
  }, [linkWithPasskey, initEnrollmentWithPasskey, submitEnrollmentWithPasskey, onEnrolled, waitForPasskeys]);

  const chooseTotp = useCallback(() => {
    setError(null);
    setBusy(true);

    void (async () => {
      try {
        const material = await initEnrollmentWithTotp();
        setTotp({ secret: material.secret, authUrl: material.authUrl });
        setStep('totp');
      } catch {
        setError(MFA_ENROL_COPY.errors.generic);
        setStep('choose');
      } finally {
        setBusy(false);
      }
    })();
  }, [initEnrollmentWithTotp]);

  const submitTotp = useCallback(() => {
    const entered = code.trim();
    if (!entered) return;

    setError(null);
    setBusy(true);

    void (async () => {
      try {
        await submitEnrollmentWithTotp({ mfaCode: entered });
        onEnrolled();
      } catch {
        setError(MFA_ENROL_COPY.errors.totp);
      } finally {
        setBusy(false);
      }
    })();
  }, [code, submitEnrollmentWithTotp, onEnrolled]);

  const back = useCallback(() => {
    setStep('choose');
    setError(null);
    setCode('');
  }, []);

  return {
    step,
    busy,
    error,
    totp,
    code,
    setCode,
    choosePasskey,
    chooseTotp,
    submitTotp,
    back,
  };
}

/**
 * The no-Privy stand-in.
 *
 * There is nothing to enrol without a provider, and the gate is disarmed on such a
 * build anyway (`useMfaGate`), so this exists only to keep hook order identical and
 * to make a caller that reaches it land in the panel's error state rather than at a
 * `usePrivy`-has-no-provider crash.
 */
function useMfaEnrolmentNoop(): MfaEnrolmentValue {
  const unavailable = useCallback(() => undefined, []);
  const noopSetCode = useCallback(() => undefined, []);
  return {
    step: 'choose',
    busy: false,
    error: MFA_ENROL_COPY.errors.generic,
    totp: null,
    code: '',
    setCode: noopSetCode,
    choosePasskey: unavailable,
    chooseTotp: unavailable,
    submitTotp: unavailable,
    back: unavailable,
  };
}

export const useMfaEnrolment: (onEnrolled: () => void) => MfaEnrolmentValue = PRIVY_APP_ID
  ? useMfaEnrolmentImpl
  : useMfaEnrolmentNoop;
