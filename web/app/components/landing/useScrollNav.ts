'use client';

import { useEffect, useRef } from 'react';
import { SCROLL_NAV_ATTRIBUTE, SCROLL_NAV_THRESHOLD_PX } from './ScrollNav.constants';
import type { ScrollNavRef } from './useScrollNav.types';

/**
 * The navbar's scrolled state, as ONE boolean written to ONE attribute.
 *
 * The reference (minisend.xyz, read out of its bundle) holds this in React state
 * and lets framer-motion animate from it. This does not need React at all: the
 * state has exactly two values, it changes a handful of times in a session, and
 * every property it drives is already a CSS transition in `globals.css`. So the
 * hook writes `data-scrolled` on the header and nothing re-renders — which is
 * the difference between a nav that is cheap to scroll past and one that puts a
 * render on the scroll path.
 *
 * THREE DETAILS THAT ARE THE WHOLE THING:
 *
 *  - **It applies once on mount.** A reload half-way down the page starts at
 *    `scrollY > 80`, where no scroll event is coming to tell the bar it is
 *    scrolled. Reading the position before subscribing is what stops the bar
 *    from sitting in its rest state until the reader twitches the wheel.
 *  - **The listener is passive and rAF-throttled.** `passive` keeps the scroll
 *    off the main thread's blocking path; the frame guard means a fast wheel
 *    coalesces into one `scrollY` read per frame instead of one per event, and
 *    the last known state is compared first, so a page scrolled within one state
 *    costs a comparison per frame and never touches the DOM.
 *  - **Nothing is read during render.** No `window`, no clock: the state is a
 *    DOM attribute set from an effect, so the server render and the first client
 *    render agree and there is no mismatch to have.
 *
 * Reduced motion is handled where it belongs, in CSS: the transition is removed,
 * so both states are reached instantly and the bar is still legible in each.
 */
export function useScrollNav(): ScrollNavRef {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const shell = ref.current;
    if (!shell) return;

    let frame = 0;
    let scrolled: boolean | null = null;

    const apply = () => {
      frame = 0;
      const next = window.scrollY > SCROLL_NAV_THRESHOLD_PX;
      if (next === scrolled) return;
      scrolled = next;
      if (next) shell.setAttribute(SCROLL_NAV_ATTRIBUTE, '');
      else shell.removeAttribute(SCROLL_NAV_ATTRIBUTE);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
