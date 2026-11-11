'use client';

import Link from 'next/link';
import { Mark, Text } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { useSession } from '@/lib/auth';
import { useAccountIdentity } from '@/lib/account';
import { useAppNetwork } from './useAppNetwork';

/**
 * What the header says about the ACCOUNT, in priority order (#542).
 *
 * 1. **Restoring** — a bar, not a word. Telling a customer who IS signed in to sign in, even for
 *    one frame, is the one thing this control must not do.
 * 2. **Not signed in** — `Sign in`, the app's one way in. This is where the rail's signed-out card
 *    went: the rail had a foot and a paragraph, a header has one row, so the control is the row.
 * 3. **Signed in** — the account's own `Mark`: initials on the tone its handle derives, the same
 *    object `ProfileIdentity` draws at 64px, at 32px here. Every bank in the reference set puts the
 *    person in the app's top corner this way (Zopa, Revolut and Monzo top-left; Neo Financial
 *    top-right), and a right-hand slot that empties the moment you sign in reads as a control that
 *    failed rather than as a state that is fine.
 * 4. **In practice, a chip before it** — `Practice`, in the network's own attention ink, linking to
 *    the page where the network is switched. The practice strip that used to state this on every
 *    screen is gone; this chip is that signal now, which is why the header is sticky.
 *
 * ## The avatar and the Profile tab
 *
 * Two doors to one page is the thing the mobile shell rule warns about, and this is a deliberate
 * exception with a reason: the dock is a list of PLACES, the header is WHO YOU ARE. Every app that
 * pairs a tab bar with a header avatar — Chime, Neo, Revolut — makes the same call, and the
 * alternative, an empty right-hand slot, makes the chrome look broken. If Profile grows a menu of
 * its own, this becomes the way into that menu rather than a second link to the page.
 */
export function TopBarState() {
  const session = useSession();
  const { practice } = useAppNetwork();
  const { identity } = useAccountIdentity();

  if (session.status === 'restoring') {
    return (
      <span aria-hidden className="flex h-11 w-16 items-center justify-center">
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

  const handle = identity?.handles?.[0]?.handle;

  return (
    <span className="flex items-center gap-1">
      {practice ? (
        <Link
          href="/app/profile"
          aria-label="Practice network — change it in Profile"
          className="flex h-11 items-center gap-1.5 rounded-lg border border-hairline-dark px-3 whitespace-nowrap transition-colors duration-(--duration-quick) ease-out hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-warning" />
          <Text
            variant="micro"
            as="span"
            color="attention"
            className="font-semibold uppercase tracking-wider"
          >
            Practice
          </Text>
        </Link>
      ) : null}

      <Link
        href="/app/profile"
        aria-label="Your profile"
        className="flex h-11 items-center justify-center rounded-full px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Mark size="sm" handle={handle} />
      </Link>
    </span>
  );
}
