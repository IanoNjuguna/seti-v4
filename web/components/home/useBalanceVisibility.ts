'use client';

import { useCallback, useState } from 'react';

/**
 * Hide/show control for every amount on the screen.
 *
 * Deliberately in-memory only. Persisting the preference would mean reading
 * localStorage during render, and this app renders on the server first — the
 * value would differ between server and client markup. Privacy state resetting
 * on reload is the safe side of that trade.
 */
export function useBalanceVisibility() {
  const [hidden, setHidden] = useState(false);
  const toggle = useCallback(() => setHidden((previous) => !previous), []);
  return { hidden, toggle };
}
