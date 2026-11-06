import { cn } from '@/lib/cn';
import type { BandProps } from './Band.types';

/**
 * One band of the page, and nothing else (#365).
 *
 * ## Why this is no longer `Reveal`
 *
 * Every band used to rise and fade once on entry, and the payment stack's rows staggered
 * behind it. The owner's call is that the page does not animate at all: a payments page for
 * merchants should read as a document, and a section that fades in is a section the reader is
 * told to wait for. The wrapper keeps its one structural job and loses the other, and the name
 * changes with it — a component called `Reveal` that reveals nothing is a lie the next reader
 * has to disprove.
 *
 * ## What it still carries, and why it is load-bearing
 *
 * `relative z-10` puts every band above the hero's backdrop layer. `scroll-mt` MUST equal the
 * scrolled nav's own height PLUS its inset: the bar is `h-16` (4rem) and, once the page is
 * scrolled, sits `--nav-inset` (8px) below the viewport's top edge, so its lower edge is at
 * 4rem + 8px. Without the inset an anchor jump such as `/#money` scrolls the band's top edge to
 * y=64, where the last 8px of the bar covers the first 8px of the band's own top padding. The
 * 8px is reserved at rest too, where it is simply 8px more air above a band that already pads
 * 88px: a scroll margin that changed with the nav's state would move the landing point
 * mid-scroll. Change this together with `.landing-nav-bar`'s height and `--nav-inset`.
 *
 * It is no longer a client component: the server and the browser now paint the same frame.
 */
export function Band({ id, className, children }: BandProps) {
  return (
    <section
      id={id}
      className={cn('relative z-10 scroll-mt-[calc(4rem+var(--nav-inset))]', className)}
    >
      {children}
    </section>
  );
}
