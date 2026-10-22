'use client';

import { useSession } from '@/lib/auth';
import { RailIdentitySignedOut } from './RailIdentitySignedOut';

/**
 * The foot of the rail: signed out, the app's ONE sign-in affordance — signed
 * in, NOTHING.
 *
 * The rail used to state who was signed in here: a "Signed in as" label, the
 * active mode's `@handle` and its public link, each on a `CopyRow` with its own
 * copy control. That whole block is gone. The same identity now opens the
 * Profile page (`ProfileIdentity`: medallion, name, `@handle`), where the person
 * is the first thing on the surface, so the rail restating it was one fact said
 * twice: chrome repeating what a page already owns.
 *
 * The block's own surface went with it. When signed in this component returns
 * `null`, not an empty card: the hairline, padding and `mt-auto` only ever
 * existed to hold the deleted rows, so keeping any of them would be a stray edge
 * around nothing. The rail's canvas simply ends after the destinations.
 *
 * The signed-out variant is untouched and is still the app's one way in: the
 * gate's rule is that a visitor is nobody yet, so the rail must be able to offer
 * `/signin` (`SIGN_IN_PATH`) even though it no longer says who a signed-in
 * person is.
 *
 * The identity READ (`useRailIdentity`) is no longer mounted by the rail; its
 * remaining consumer is the Receive page's name half.
 */
export function RailIdentityCard() {
  const session = useSession();

  if (session.status === 'signed-in') {
    return null;
  }

  return <RailIdentitySignedOut view={session.status} />;
}
