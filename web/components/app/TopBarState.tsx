'use client';

import Link from 'next/link';
import { Text } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { useSession } from '@/lib/auth';
import { useAccountIdentity } from '@/lib/account';
import { useAppNetwork } from './useAppNetwork';

/**
 * What the header says about the ACCOUNT, in priority order (#542).
 *
 * 1. **Restoring** — a bar, not a word. Telling a customer who IS signed in to sign in, even for
 *    one frame, is the one thing this control must not do.
 * 2. **Not signed in** — `Sign in`, the app's one way in, in the app's ACTION FILL (#559). This is
 *    where the rail's signed-out card went: the rail had a foot and a paragraph, a header has one
 *    row, so the control is the row.
 *
 *    The fill is `accent-lime`, the same one the landing's `Claim your name` carries
 *    (`VARIANT_CLASSES.accent`), because a visitor arriving from that button meets the same colour
 *    one step later instead of a second vocabulary. Every other control in this chrome is type on
 *    black; the one thing a visitor can DO should not be.
 *
 *    Measured, not chosen by eye: the fill clears 12.82:1 against `canvas-dark`, so it needs no
 *    border to read as a control — the landing's 1px `ink` border exists because a yellow fill on a
 *    white band has no edge at all (1.64:1). The label is `ink` at 12.08:1 on the fill; white would
 *    measure 1.64:1 and is unusable there. Hover steps the fill down one notch to `accent-lime-deep`
 *    (`#b8b006`), where the same ink measures 8.72:1, so the label colour never changes. The focus
 *    ring is `on-dark` with a `canvas-dark` offset rather than the system cobalt the white-page
 *    buttons use: this control lives on black, where a cobalt ring is a smudge.
 * 3. **Signed in** — `@handle`, in a text control rather than the pill `Sign in` wears, opening
 *    `/app/profile`.
 *    The handle rather than `Mark`, deliberately: the mark is now the PRODUCT's face (one alien for
 *    every account), so drawing it here would put a second alien beside the brand's for no gain.
 *    The handle is the string that identifies the person — it is what a sender types — and it is
 *    what every bank prints beside the avatar when it is not drawing a photo (Zopa's "Hi <name>",
 *    Revolut's name under the avatar). A right-hand slot that empties the moment you sign in reads
 *    as a control that failed rather than as a state that is fine.
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
        className="flex h-11 items-center rounded-md bg-accent-lime px-3.5 whitespace-nowrap transition-colors duration-(--duration-quick) ease-out hover:bg-accent-lime-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
      >
        <Text variant="tab" as="span" color="primary">
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
          className="flex h-11 items-center gap-1.5 rounded-md border border-hairline-dark px-3 whitespace-nowrap transition-colors duration-(--duration-quick) ease-out hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        className="flex h-11 max-w-40 items-center rounded-md px-3 whitespace-nowrap transition-colors duration-(--duration-quick) ease-out hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Text variant="tab" as="span" color="inverse" className="truncate">
          {handle ? `@${handle}` : 'Profile'}
        </Text>
      </Link>
    </span>
  );
}
