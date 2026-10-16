'use client';

import { useEffect, type RefObject } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Reveal a section once, when it first enters the viewport.
 *
 * Deliberately not `useState`: the reveal is a one-way visual change, so it is
 * written as a data attribute on the section and React never re-renders while
 * the page is being scrolled.
 *
 * The hidden state is ARMED here, in the effect — `data-reveal` is added by JS
 * and by nothing else. That ordering is the whole point: the server-rendered
 * HTML is visible, so a page that never hydrates still shows every word, and a
 * browser with JS disabled is not shown a blank marketing page.
 */
export function useRevealOnce(ref: RefObject<HTMLElement | null>): void {
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (reduced) {
      element.setAttribute('data-revealed', '');
      return;
    }

    element.setAttribute('data-reveal', '');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          element.setAttribute('data-revealed', '');
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -12% 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, reduced]);
}
