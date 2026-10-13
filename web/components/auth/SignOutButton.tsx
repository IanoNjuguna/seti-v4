'use client';

import { Button } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { PrivySignOutControl } from './PrivySignOutControl';

/**
 * The one sign-out control, whichever way this build signs in.
 *
 * A `privy` session has two things to end (Privy's session and ours); a `dev`
 * session has only ours. Picking here keeps `usePrivy` out of every component
 * that offers a sign-out, and keeps it out of the `dev` path entirely — where
 * there is no Privy provider to read from.
 */
export function SignOutButton() {
  const { source, signOut } = useSession();

  if (source === 'privy') {
    return <PrivySignOutControl />;
  }

  return (
    <Button variant="secondary" onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}
