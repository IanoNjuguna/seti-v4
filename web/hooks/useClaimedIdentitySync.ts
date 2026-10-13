'use client';

import { useEffect } from 'react';
import { fetchAccountIdentity } from '@/lib/api';
import { useAccountIdentity } from '@/lib/account';

/**
 * Re-read the account once a claim has landed, so the rest of the app sees it.
 *
 * The gate and the Profile card both read the account identity from ONE provider,
 * and that provider reads it once per sign-in. A claim made from `/app/merchant`
 * therefore lands behind its back: the handle exists in the database while the app
 * still believes the account holds none — so the row the person just claimed would
 * not appear in Profile until a reload, and (for the account's first handle) the
 * gate would still be refusing the app.
 *
 * State is written only from the promise callbacks, never in the effect body:
 * `react-hooks/set-state-in-effect` is an error in this package, and a synchronous
 * setState here would cascade a render. Only the two stable context functions are
 * dependencies — depending on the whole context value would re-run this effect every
 * time it wrote, and refetch in a loop.
 *
 * An `active` guard means a slow response cannot write after unmount, and a failed
 * re-read falls back to the provider's own refresh rather than leaving a claim that
 * landed invisible.
 */
export function useClaimedIdentitySync(claimed: boolean): void {
  const { apply, refresh } = useAccountIdentity();

  useEffect(() => {
    if (!claimed) return;

    let active = true;

    fetchAccountIdentity()
      .then((identity) => {
        if (active) apply(identity);
      })
      .catch(() => {
        if (active) refresh();
      });

    return () => {
      active = false;
    };
  }, [claimed, apply, refresh]);
}
