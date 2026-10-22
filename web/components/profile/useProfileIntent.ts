'use client';

import { useCallback, useState } from 'react';
import { ApiError, setAccountIntent } from '@/lib/api';
import type { AccountIntent } from '@/lib/api';
import { useAccountIdentity } from '@/lib/account';
import type { UseProfileIntentReturn } from './ProfileIntent.types';

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Could not switch. Try again.';
}

/**
 * The account's mode, and how to change it.
 *
 * The mode is READ from the account (`GET /account`), never held here: the same
 * answer the gate routes on, so a switch cannot leave this row saying "business"
 * while the rest of the app disagrees.
 *
 * Switching writes the preference and ADOPTS the server's answer. It never claims
 * anything and never refuses: a mode with no name claimed yet is a normal state,
 * because blocking the switch until the name existed is exactly the one-way door
 * this is meant to avoid.
 *
 * The handle behind each mode is not read here any more. The identity block at the
 * top of the page states the name the account is acting under, from the same
 * `handleForIntent` bridge this hook used to call.
 */
export function useProfileIntent(): UseProfileIntentReturn {
  const account = useAccountIdentity();
  const [switching, setSwitching] = useState<AccountIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intent = account.identity?.intent ?? 'personal';

  const switchTo = useCallback(
    async (mode: AccountIntent) => {
      if (mode === intent) return;

      setSwitching(mode);
      setError(null);

      try {
        account.apply(await setAccountIntent(mode));
      } catch (cause) {
        setError(toMessage(cause));
      } finally {
        setSwitching(null);
      }
    },
    [account, intent]
  );

  return { intent, switching, error, switchTo };
}
