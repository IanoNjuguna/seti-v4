'use client';

import { useEffect, type RefObject } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Arm the footer statement's word by word activation, once, when the line comes
 * into view.
 *
 * THE SAME ARRANGEMENT AS `useRevealOnce`, for the same reason: the hidden state is
 * written by JS and by nothing else, so a server render — or a browser with no
 * JavaScript — shows every word at full strength instead of a grey paragraph. The
 * muted start is `0.3` opacity, inside the range `landing-page-design` B11 asks for
 * (25 to 35%), and it is a mid-transition state only: the words end at `on-dark`.
 *
 * NOT PER-WORD OBSERVERS. Every word crossing a trigger line is the specification;
 * ten `IntersectionObserver`s on the last band of the page is what the specification
 * would cost if read literally, and one observer plus a CSS stagger of 40ms reads the
 * same to a person. `design/motion.md` forbids per-ELEMENT section reveals, and this
 * is not one: it is a single text device, fired once, in the footer.
 */
export function useFooterStatement(ref: RefObject<HTMLElement | null>): void {
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (reduced) {
      element.setAttribute('data-statement-shown', '');
      return;
    }

    element.setAttribute('data-statement-armed', '');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          element.setAttribute('data-statement-shown', '');
          observer.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, reduced]);
}
