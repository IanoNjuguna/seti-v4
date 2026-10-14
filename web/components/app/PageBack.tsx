import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

export interface PageBackProps {
  /** Where Back lands. The home tab by default. */
  href?: string;
  /**
   * The accessible name. A word, not a glyph: `Icon` is `aria-hidden`, so a
   * rotated chevron alone would announce as nothing at all.
   */
  label?: string;
}

/**
 * The way back from a full-page surface to the tab it was opened from.
 *
 * A `Link` rather than `router.back()`: these pages open cold — a bookmark, a
 * refresh, a shared URL — where there is no history to pop, and `Back` promises a
 * deterministic destination. The home tab is that destination, so Back can never
 * dead-end the way an empty history could.
 *
 * The label is the word "Back". There is no left-arrow icon in the set, and
 * `chevronRight` rotated 180° is only the glyph — `Icon` marks it `aria-hidden`,
 * so it is not announced as "chevron right" and the word carries the name.
 */
export function PageBack({ href = '/app', label = 'Back' }: PageBackProps) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 self-start rounded-md py-2 pl-3 pr-4 text-body-sm font-semibold text-ink transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
      {label}
    </Link>
  );
}
