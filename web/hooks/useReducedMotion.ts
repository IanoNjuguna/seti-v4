'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** Server and first client render: motion is on, then corrected from the query. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * The one owner of `prefers-reduced-motion` (`design/motion.md`, guardrail 4).
 *
 * `useSyncExternalStore` rather than state + effect: the media query *is* an
 * external store, and `react-hooks/set-state-in-effect` is an error in this
 * package, so reading it in an effect body would not compile anyway. A single
 * hook so every caller answers the question the same way — the spec asks for
 * one, not one per component.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
