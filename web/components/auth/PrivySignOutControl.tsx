'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, StateMessage } from '@/components/ui';
import { useSession } from '@/lib/auth';

/**
 * Sign out of BOTH sessions — Privy's, then ours.
 *
 * Order matters: clearing only the local session leaves Privy authenticated, and
 * the sign-in effect then exchanges straight back in, so the button looks dead.
 *
 * Failure matters too. Privy's logout is a network call and does fail — a 400 when
 * the session is already gone, or simply offline. Whatever happens, OUR session has
 * to end, because leaving it is the dead-button state again. The one case worth
 * reporting is a failure where Privy still holds the session: that is the case
 * where the next exchange would silently undo the sign-out.
 */
export function PrivySignOutControl() {
  const { logout, authenticated } = usePrivy();
  const { signOut } = useSession();
  const [error, setError] = useState<string | null>(null);

  const authenticatedRef = useRef(authenticated);
  useEffect(() => {
    authenticatedRef.current = authenticated;
  }, [authenticated]);

  const handleSignOut = useCallback(async () => {
    setError(null);

    let failed = false;
    try {
      await logout();
    } catch {
      failed = true;
    }

    // Only consulted on the failure path: right after a *successful* logout the
    // state may not have committed yet, so checking here would report a failure
    // that did not happen.
    if (failed && authenticatedRef.current) {
      setError('The Privy session is still active. Try again, or clear this site’s data.');
      return;
    }

    await signOut();
  }, [logout, signOut]);

  return (
    <div className="flex flex-col gap-4">
      <Button variant="destructive-soft" fullWidth onClick={() => void handleSignOut()}>
        Sign out
      </Button>
      {error ? <StateMessage variant="failure" title="Could not sign out" body={error} /> : null}
    </div>
  );
}
