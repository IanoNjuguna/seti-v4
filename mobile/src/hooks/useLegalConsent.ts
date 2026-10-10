import { useCallback, useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { readConsent, writeConsent } from '@/lib/legal/legal.consent';
import type { ConsentRecord } from '@/lib/legal/legal.consent';

interface ConsentState {
  /** Consent for the current summary version has been recorded. */
  hasConsent: boolean;
  /** True while the stored record is being read. */
  isLoading: boolean;
  /** Persists acceptance. Resolves false if storage write fails. */
  accept: () => Promise<boolean>;
  /** The stored record, if any. */
  record: ConsentRecord | null;
}

/**
 * Reads and records the user's acceptance of the Terms and Privacy Policy.
 *
 * The app treats acceptance as a precondition for onboarding rather than
 * showing a dismissible banner, because the checkbox it backs is a gate on
 * account creation.
 */
export function useLegalConsent(): ConsentState {
  const [hasConsent, setHasConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [record, setRecord] = useState<ConsentRecord | null>(null);

  useEffect(() => {
    let active = true;

    readConsent()
      .then((stored) => {
        if (!active) return;
        setRecord(stored);
        setHasConsent(stored !== null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const accept = useCallback(async () => {
    const appVersion = Constants.expoConfig?.version as string | undefined;
    try {
      const written = await writeConsent(appVersion);
      setRecord(written);
      setHasConsent(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { hasConsent, isLoading, accept, record };
}
