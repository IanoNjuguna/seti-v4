'use client';

import Link from 'next/link';
import { Text } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { useSession } from '@/lib/auth';
import { useAppNetwork } from './useAppNetwork';

/**
 * What the header says about the ACCOUNT, in priority order (#542).
 *
 * 1. **Restoring** — a bar, not a word. Telling a customer who IS signed in to sign in, even for
 *    one frame, is the one thing this control must not do.
 * 2. **Not signed in** — `Sign in`, the app's one way in. This is where the rail's signed-out card
 *    went: the rail had a foot and a paragraph, a header has one row, so the control is the row.
 * 3. **Signed in, in practice** — `Practice`, a chip that goes to `/app/profile`, which is where the
 *    network is switched. The rail used to carry this as a row of its own; the practice strip above
 *    the content states the fact, and this is the way to the control, at the nav geometry's own size.
 * 4. **Signed in, live** — nothing at all. Live is the app's normal state and a chip reading
 *    `LIVE` would be the loudest thing in the chrome and the least informative.
 *
 * Nothing here is a destination, so nothing here competes with the dock: `Sign in` is an action and
 * `Practice` is a state, and neither is a fourth place to go.
 */
export function TopBarState() {
  const session = useSession();
  const { practice } = useAppNetwork();

  if (session.status === 'restoring') {
    return (
      <span aria-hidden className="flex h-9 w-16 items-center justify-center">
        <span className="block h-3 w-10 rounded-sm bg-hairline-dark" />
      </span>
    );
  }

  if (session.status !== 'signed-in') {
    return (
      <Link
        href={SIGN_IN_PATH}
        className="flex h-11 items-center rounded-lg px-3 whitespace-nowrap transition-colors duration-(--duration-quick) ease-out hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Text variant="tab" as="span" color="inverse">
          Sign in
        </Text>
      </Link>
    );
  }

  if (!practice) return null;

  return (
    <Link
      href="/app/profile"
      aria-label="Practice network — change it in Profile"
      className="flex h-11 items-center gap-1.5 rounded-lg border border-hairline-dark px-3 whitespace-nowrap transition-colors duration-(--duration-quick) ease-out hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-warning" />
      <Text variant="tab" as="span" color="inverse">
        Practice
      </Text>
    </Link>
  );
}
