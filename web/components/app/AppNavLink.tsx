'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import type { AppNavLinkProps } from './AppNavLink.types';

/**
 * One destination, in whichever nav it is drawn in.
 *
 * `nav-bar` is black canvas with `on-dark` text, so the active destination is
 * `on-dark` (white) on `surface-elevated` and the rest sit at `on-dark-mute`.
 *
 * The active state is a *shape* as well as a luminance step, because colour alone
 * cannot be an indicator: in the bar the mark sits in a 48×32 well that is
 * transparent until it is active, and in the rail the whole row is the filled
 * block. Both take the same `surface-elevated` step, so the two layouts read as
 * one navigation. The well is drawn around the icon rather than the whole tile so
 * nothing reflows when you navigate.
 *
 * Geometry is per layout and derived from the type inside it: the bar is a 64px
 * `nav-bar` row — 24px mark, 8px, 20px label — and the rail is a 48px row, whose
 * 24px mark and 20px label share one centred axis.
 */
const LAYOUT: Record<AppNavLinkProps['layout'], string> = {
  bar: 'min-h-16 flex-1 flex-col items-center justify-center gap-2',
  rail: 'min-h-12 w-full flex-row items-center gap-3 rounded-md px-4',
};

/** The mark's well: the 48×32 block in the bar, a plain 24px box in the rail. */
const WELL: Record<AppNavLinkProps['layout'], string> = {
  bar: 'h-8 w-12 rounded-md',
  rail: 'h-6 w-6',
};

export function AppNavLink({ item, active, layout }: AppNavLinkProps) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active ? 'text-on-dark' : 'text-on-dark-mute',
        layout === 'rail' && (active ? 'bg-surface-elevated' : 'hover:bg-surface-deep'),
        LAYOUT[layout]
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center transition-colors duration-200',
          WELL[layout],
          layout === 'bar' && active && 'bg-surface-elevated'
        )}
      >
        <Icon name={item.icon} className="h-6 w-6" />
      </span>
      <Text variant="tab" as="span" color={active ? 'inverse' : 'inverse-muted'}>
        {item.label}
      </Text>
    </Link>
  );
}
