'use client';

import { useEffect, useState } from 'react';

/**
 * Is the page scrolled far enough that the chrome is sitting OVER content?
 *
 * The header is opaque black on a white canvas, so the boundary between it and the page is only
 * worth drawing when there is something on the other side of it. At rest the bar ends and the page
 * begins, which needs no edge; once a card slides under it, the edge is what stops the card's top
 * looking sliced off (#559). That is the whole question, so it is the whole hook.
 *
 * A scroll listener rather than a sentinel or a scroll-timeline animation: the answer has to be the
 * same in every browser the app runs in, and `animation-timeline: scroll()` is not. The listener is
 * `passive` and the state is read once per animation frame, so a scroll cannot queue seventy React
 * renders behind it, and `setScrolled` with an unchanged boolean does not re-render at all.
 *
 * `4px` rather than `0`: a trackpad's first event is often a sub-pixel nudge, and a divider that
 * flickers on while the page has not visibly moved reads as a glitch. Restoring scroll position on
 * mount is read through `read()` before any event arrives, so a reload halfway down a page comes
 * back with the edge already there instead of appearing on the first wheel turn.
 */
export function useScrolled(threshold = 4): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return scrolled;
}
