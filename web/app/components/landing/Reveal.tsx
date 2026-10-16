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
    <section id={id} ref={ref} className={cn('reveal relative z-10 scroll-mt-16', className)}>
      {/* `scroll-mt-16` (64px) MUST equal the fixed nav's `h-16`. Without it an anchor jump
          such as /#money scrolls the band's top edge to y=0, where the opaque nav covers the
          first 64px of it — eating that much of the band's own top padding, so the eyebrow and
          heading appear jammed against the nav. Change both together. */}
      {children}
    </section>
  );
}
