'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';
import { useRevealOnce } from '@/hooks/useRevealOnce';
import type { RevealProps } from './Reveal.types';

/**
 * One section of the page, rising `--distance-small` and fading in ONCE on
 * entry (`design/motion.md`, DIAL ONE: per section, never per element).
 *
 * The section is only ever a thin wrapper: every band keeps its own layout and
 * its own canvas, so the page reads as bands rather than as a stack of the same
 * card grid. The reveal itself is in `useRevealOnce`; this file has no logic.
 */
export function Reveal({ id, className, children }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  useRevealOnce(ref);

  return (
    <section
      id={id}
      ref={ref}
      className={cn(
        'reveal relative z-10 scroll-mt-[calc(4rem+var(--nav-inset))]',
        className
      )}
    >
      {/* `scroll-margin-top` MUST equal the scrolled nav's own height PLUS its inset. The bar
          is `h-16` (4rem) and, once the page is scrolled, sits `--nav-inset` (8px) below the
          viewport's top edge, so its lower edge is at 4rem + 8px. Without the inset an anchor
          jump such as /#money scrolls the band's top edge to y=64, where the last 8px of the
          bar covers the first 8px of the band's own top padding. The 8px is reserved at rest
          too, where it is simply 8px more air above a band that already pads 88px: a scroll
          margin that changed with the nav's state would move the landing point mid-scroll.
          Change this together with `.landing-nav-bar`'s height and `--nav-inset`. */}
      {children}
    </section>
  );
}
