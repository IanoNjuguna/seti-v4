'use client';

import { useEffect, useState } from 'react';

/**
 * False for the first `thresholdMs`, true after that, for as long as the caller
 * stays mounted.
 *
 * The sign-in handoff is drawn for the length of one `router.replace`
 * (`useSignedInRedirect`), which on a warm client is a few frames: a screen that
 * exists for a few frames is not a screen, it is a flash. So the decision is
 * made on ELAPSED TIME rather than on the state alone, and the handoff mounts
 * under every completion but only becomes visible once the wait has lasted long
 * enough to be a wait.
 *
 * The timer is the only writer of this state, and it is cleared on unmount, so
 * the transition cannot set state on a screen that is already gone.
 */
export function useHandoffVisible(thresholdMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), thresholdMs);
    return () => clearTimeout(timer);
  }, [thresholdMs]);

  return elapsed;
}
