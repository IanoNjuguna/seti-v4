'use client';

import { useEffect, useRef } from 'react';

/**
 * Replays the `value-changed` animation on the returned ref's element whenever
 * `value` changes — NEVER on the first render.
 *
 * Why imperative, when this repo writes almost nothing imperatively:
 * React has no declarative "replay this CSS animation when a prop changes".
 * The two declarative alternatives are both worse here — a `key={value}`
 * remount cannot tell a first paint from a change, and tracking the previous
 * value in state means a synchronous `setState` inside an effect, which
 * `react-hooks/set-state-in-effect` rejects outright in this package (and it is
 * right: it cascades a render for a decoration). A ref plus a class toggle is
 * the smallest correct answer, and the class is removed-then-re-added so a rapid
 * series of quotes restarts the fade rather than queuing.
 *
 * The first render is deliberately silent: the quote's ARRIVAL is already
 * carried by a haptic (`quoteArrived`, `lib/feedback`), and `design/motion.md`
 * guardrail 6 forbids stacking two channels on one moment. Only a re-quote —
 * the figure changing under an amount the customer is still typing — fades.
 */
export function useHighlightOnChange<T extends HTMLElement>(value: string) {
  const ref = useRef<T | null>(null);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;

    const element = ref.current;
    if (!element) return;

    element.classList.remove('value-changed');
    // Force the style recalculation that lets the same animation replay.
    void element.offsetWidth;
    element.classList.add('value-changed');
  }, [value]);

  return ref;
}
