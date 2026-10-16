'use client';

import Link from 'next/link';
import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { NETWORK_LABEL } from '@/lib/network';
import { APP_FRAME_COPY } from './AppFrame.constants';
import { useAppNetwork } from './useAppNetwork';

/** Where the network is actually chosen — this row is the way there, not a page. */
const SWITCH_HREF = '/app/profile';

/**
 * The rail's network row: one word and a dot, in PRACTICE only.
 *
 * It replaced a badge plus a `Network: Practice` label that said one word twice
 * and wrapped to three lines in a 224px rail. One row, one fact, at the nav rows'
 * own geometry (`min-h-12`, `rounded-md px-4`) so the rail's rhythm is untouched —
 * including their press, `active:bg-surface-elevated` on `--duration-quick`, so a
 * row that opens a control answers the same way the rows that change screens do.
 *
 * It is a LINK, not a label: the rail is chrome, and chrome that only reports a
 * state leaves the customer to go and find the control. Clicking it opens the
 * Network card in Profile — the single place a switch happens — and the chevron
 * is what says "this opens something" rather than "this is a page you are on".
 *
 * On live it renders nothing at all: Live is the app's normal state, and a chip
 * reading `LIVE · NETWORK: LIVE` was the loudest thing in the chrome and the
 * least informative. Colour is never the only signal — the dot is `aria-hidden`
 * and the word is there beside it.
 */
export function RailNetworkRow() {
  const { practice, network } = useAppNetwork();

  if (!practice) return null;

  return (
    <Link
      href={SWITCH_HREF}
      aria-label={APP_FRAME_COPY.railRowHint}
      className="mb-2 flex min-h-12 w-full items-center gap-3 rounded-md px-4 transition-colors duration-(--duration-quick) ease-out hover:bg-surface-deep active:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent-warning" />
      <Text variant="tab" as="span" color="attention">
        {NETWORK_LABEL[network]}
      </Text>
      <Icon name="chevronRight" className="ml-auto h-4 w-4 text-on-dark-mute" />
    </Link>
  );
}
