'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, fetchAccountIdentity } from '@/lib/api';
import type { AccountIdentity } from '@/lib/api';
import { useSession } from '@/lib/auth';
import type { AccountIdentityValue } from './account.types';

/**
 * An answer is only ever valid for the account it was read FOR.
 *
 * Held together with its `userId` rather than as a bare identity, because
 * signing out and back in as someone else must not leave the previous account's
 * handles on screen — and, worse, must not let the previous account's
 * `onboarded: true` wave the new one into the app.
 */
interface LoadedIdentity {
  userId: string;
  identity: AccountIdentity;
}

interface FailedIdentity {
  userId: string;
  error: string;
}

const AccountIdentityContext = createContext<AccountIdentityValue | null>(null);

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Could not read your account. Try again.';
}

/**
 * The account's handles and mode, read once per sign-in for the whole `/app`.
 *
 * The read is what answers "has this account finished onboarding?" — `onboarded`
 * comes back DERIVED by the backend from whether a handle exists, so no component
 * re-derives it and no client can disagree with the server about it.
 *
 * State is written only from the promise callbacks: `react-hooks/set-state-in-effect`
 * is an error in this package, and a synchronous setState in an effect body
 * cascades a render. `loading` is derived from whether an answer for THIS account
 * has arrived, so there is no separate flag to keep in sync.
 */
export function AccountIdentityProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const userId = session.user?.id ?? null;
  const [loaded, setLoaded] = useState<LoadedIdentity | null>(null);
  const [failed, setFailed] = useState<FailedIdentity | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    fetchAccountIdentity()
      .then((identity) => {
        if (!active) return;
        setLoaded({ userId, identity });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFailed({ userId, error: toMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const apply = useCallback(
    (identity: AccountIdentity) => {
      if (!userId) return;
      setLoaded({ userId, identity });
      setFailed(null);
    },
    [userId]
  );

  const value = useMemo<AccountIdentityValue>(() => {
    const identity = loaded?.userId === userId ? loaded.identity : null;
    const error = failed?.userId === userId ? failed.error : null;

    return {
      identity,
      loading: Boolean(userId) && identity === null && error === null,
      error,
      // Fail closed: an unknown or failed read is not an onboarded account.
      onboarded: identity?.onboarded ?? false,
      refresh,
      apply,
    };
  }, [loaded, failed, userId, refresh, apply]);

  return (
    <AccountIdentityContext.Provider value={value}>{children}</AccountIdentityContext.Provider>
  );
}

export function useAccountIdentity(): AccountIdentityValue {
  const context = useContext(AccountIdentityContext);
  if (!context) {
    throw new Error('useAccountIdentity must be used within an AccountIdentityProvider');
  }
  return context;
}
