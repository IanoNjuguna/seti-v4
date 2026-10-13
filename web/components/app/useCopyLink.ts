'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { writeToClipboard } from '@/lib/clipboard';
import type { CopyLinkState, UseCopyLinkReturn } from './RailIdentity.types';

/** How long the confirmation stays up before the control goes quiet again. */
const COPIED_RESET_MS = 2000;

/**
 * Copy one string, and say what happened.
 *
 * The failure state is not collapsed into the success one: a copy the browser
 * blocked is exactly the case where the person must select the link by hand, and
 * pretending it worked leaves them pasting whatever was on the clipboard before.
 *
 * State is written only from the promise callback, and the timer is cleared on
 * unmount, so a dismissed rail cannot be written to after it is gone.
 */
export function useCopyLink(text: string): UseCopyLinkReturn {
  const [state, setState] = useState<CopyLinkState>('idle');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(() => {
    void writeToClipboard(text).then((ok) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      setState(ok ? 'copied' : 'failed');
      if (ok) timer.current = window.setTimeout(() => setState('idle'), COPIED_RESET_MS);
    });
  }, [text]);

  return { state, copy };
}
