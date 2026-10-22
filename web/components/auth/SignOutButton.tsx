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
 *
 * BOTH paths wear `destructive-soft`: a full-width soft pill whose label is the
 * destructive text role, not the filled primary button it used to be. Sign out is
 * the last row on the page and the one thing a customer should not tap by
 * accident, and a black 48px CTA at the end of a settings list read as the page's
 * main action, which it is not.
 */
export function SignOutButton() {
  const { source, signOut } = useSession();

  if (source === 'privy') {
    return <PrivySignOutControl />;
  }

  return (
    <Button variant="destructive-soft" fullWidth onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}
