'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import type { AppNavLinkProps } from './AppNavLink.types';

/**
 * One destination in the app's dock (#542).
 *
 * `nav-bar` is black canvas with `on-dark` text, so the active destination reads as
 * `on-dark` (white) on `surface-elevated` and the rest sit at `on-dark-mute`.
 *
 * The active state is a SHAPE as well as a luminance step, because colour alone cannot be an
 * indicator: the whole well fills, so the selected destination is a filled square with rounded
 * corners rather than a brighter glyph. The well is drawn around the ITEM rather than around the
 * glyph alone, which is the one geometric difference from the old bottom bar — in a dock the item
 * is the tap target, and `rounded-md` (12px) is what makes the row read as "square with round
 * edges".
 *
 * `rounded-md`, not `rounded-lg` (#559). The project's radius scale is `sm` 8px, `md` 12px, `lg`
 * 20px, `xl` 28px, so `lg` on a 44px-tall well rendered a 20px radius: a capsule 24px from being a
 * pill, and ROUNDER than the 14px dock slab it sits inside. That inverted the shape the dock's own
 * comment asks for in as many words ("square with round edges, not round with square edges"), and
 * nothing caught it because the check asserted the class name `rounded-lg` while its comment claimed
 * 8px. The system's one control radius is 12px (`design/revolut.md`: buttons, cards, inputs), and a
 * filled well is a control.
 *
 * A tap is answered on the way there, not after: `active:bg-surface-elevated` fills the well while
 * the finger is down, so the destination lights up on the press rather than on the route change.
 * The dock is the most-tapped control in the app and a control that answers only on release reads
 * as dead. The transition runs on `--duration-quick`; a literal 200ms was a fourth duration
 * nothing else in the app used.
 *
 * Geometry: a 44x48 well — the 44px minimum touch target, a 20px glyph above a 12px label —
 * inside a 64px slab. `min-w` rather than `w`, so a longer label widens its own item instead of
 * wrapping.
 *
 * There is no `layout` prop any more. The dock is the app's only nav at every width, so the two
 * geometries this used to switch between (the bottom bar's 48x32 well and the rail's 48px row)
 * have nothing left to choose between — and a second geometry is how one navigation starts
 * rendering two ways.
 */
export function AppNavLink({ item, active }: AppNavLinkProps) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1.5 transition-colors duration-(--duration-quick) ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active
          ? 'bg-surface-elevated text-on-dark'
          : 'text-on-dark-mute hover:bg-surface-deep active:bg-surface-elevated'
      )}
    >
      <Icon name={item.icon} className="h-5 w-5" />
      <Text variant="tab" as="span" color={active ? 'inverse' : 'inverse-muted'}>
        {item.label}
      </Text>
    </Link>
  );
}
