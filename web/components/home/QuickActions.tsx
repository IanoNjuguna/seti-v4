'use client';

import Link from 'next/link';
import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { QUICK_ACTIONS } from './quick-actions.constants';

/**
 * One tile: an icon well with its label under it, sized to its own content and
 * left-aligned in the row.
 *
 * Sized to content, deliberately NOT `flex-1`. With two destinations an equal
 * share of a 305px row parked a 48px well in the middle of a 148px tile — a
 * 100px hole either side of every icon, which is the void that made the row read
 * as two isolated things instead of a group. Content-sized, the two wells sit one
 * `gap-4` (16px) apart plus their own 8px padding, and the space the row does not
 * use is trailing margin rather than a hole *between* the actions — the shape a
 * row of iOS shortcuts has. `min-h-11`/`px-2` keep every tile past the 44px tap
 * minimum at both ends of the label range.
 *
 * Three destinations were re-measured in a production build rather than assumed:
 * the tiles come out 69.75px (Deposit — its label is the widest at 53.75px), 64px
 * (Send) and 64px (Pay), so the row occupies 197.75 + 2 × 16px gaps = 229.75px of
 * a 320px column at a 360px viewport (280px at 320px). One row, `nowrap`, no tile
 * shrinks below its well, ~90px of trailing canvas. Adding the third tile
 * therefore needed no change to this geometry: it is one line in
 * `quick-actions.constants.ts`.
 */
const TILE =
  'group inline-flex min-w-0 flex-col items-center gap-2 rounded-md px-2 py-1 text-center transition-transform duration-(--duration-instant) ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/**
 * The icon well. `surface-soft` stepping to `faint` on hover — the same step the
 * `pill` button takes — because a `surface-soft` hover on the tile itself painted
 * the well the same colour as the tile and the well disappeared.
 */
const WELL =
  'flex h-12 w-12 items-center justify-center rounded-md bg-surface-soft text-ink transition-colors duration-(--duration-quick) ease-out group-hover:bg-faint';

/**
 * The action strip: the things the home screen sends you away for.
 *
 * Every tile here is a link to a real destination. There is deliberately no
 * "disabled tile" styling: an inert tile reads as a broken tap rather than as an
 * unbuilt feature.
 *
 * The label is the type primitive's `tab` role in the `primary` colour role, not
 * the two utility classes it happens to equal. A hand-spelled `text-body-sm
 * font-semibold text-ink` is a second copy of a primitive, and this app has paid
 * for that twice already (the colour-order defect in `Text.constants.ts`, and the
 * two-size collision in the rail's wordmark).
 */
export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="flex items-center gap-4">
      {QUICK_ACTIONS.map((action) => (
        <Link key={action.key} href={action.href} className={TILE}>
          <span className={WELL}>
            <Icon name={action.icon} className="h-6 w-6" />
          </span>
          <Text variant="tab" as="span" color="primary">
            {action.label}
          </Text>
        </Link>
      ))}
    </nav>
  );
}
