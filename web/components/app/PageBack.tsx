import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { ICON_CONTROL_CLASS } from '@/components/ui/IconButton.constants';

export interface PageBackProps {
  /** Where Back lands. The home tab by default. */
  href?: string;
  /**
   * The accessible name. A word, not a glyph: `Icon` is `aria-hidden`, so a rotated chevron alone
   * would announce as nothing at all, and `title` carries the same word for a pointer.
   */
  label?: string;
}

/**
 * The way back from a full-page surface to the tab it was opened from: a circle with a chevron.
 *
 * A `Link` rather than `router.back()`: these pages open cold, from a bookmark, a refresh or a
 * shared URL, where there is no history to pop, and `Back` promises a deterministic destination.
 * The home tab is that destination, so Back can never dead-end the way an empty history could.
 *
 * It wears `IconButton`'s exact geometry (`ICON_CONTROL_CLASS`: 44px, a circle, the focus ring) and
 * not its `<button>`, because it is navigation. Sharing the constant is the point: a back control
 * two pixels off the icon button beside it is the drift this system keeps paying for.
 *
 * The well is TRANSPARENT at rest and fills on hover, where an `IconButton` sits in `surface-soft`
 * permanently. A page header has one quiet control and one loud word: a filled 44px disc beside the
 * heading reads as a chip competing with the title, and the title is what a person came to read. The
 * circle is the hit area and the hover state, not the resting paint.
 *
 * It used to be the word `Back` in 14px semibold with `8px 16px 8px 12px` of padding and no
 * container. That put the label 12px right of the column edge every other element starts on, and
 * materialised as a grey smudge on hover, because its resting state was invisible AND it had no
 * shape: the glyph now has a 44px circle to earn its hover (#438).
 */
export function PageBack({ href = '/app', label = 'Back' }: PageBackProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(ICON_CONTROL_CLASS, 'text-ink hover:bg-surface-soft')}
    >
      <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
    </Link>
  );
}
