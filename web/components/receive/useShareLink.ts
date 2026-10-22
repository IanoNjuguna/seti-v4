'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { writeToClipboard } from '@/lib/clipboard';
import type { ShareState, UseShareLinkReturn } from './useShareLink.types';

/** How long the confirmation holds before the control goes quiet again. */
const CONFIRMED_MS = 2000;

/**
 * Share one string with the OS sheet, and say what happened.
 *
 * The fallback is deliberate, not a nicety: `navigator.share` does not exist on
 * desktop Chrome or Firefox, so hiding the control there would mean an affordance
 * that appears on a phone and vanishes on a laptop. Where the sheet is missing, or
 * where it throws for a reason that is not a dismissed sheet, the string goes to the
 * clipboard instead and the control says so. Same button, same intent, an honest
 * word in each case.
 *
 * A dismissed sheet (`AbortError`) is not a failure: the person chose to close it,
 * and an error line under their thumb would be a lie about what happened.
 */
export function useShareLink(title: string, url: string): UseShareLinkReturn {
  const [state, setState] = useState<ShareState>('idle');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const settle = useCallback((next: ShareState) => {
    setState(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), CONFIRMED_MS);
  }, []);

  const share = useCallback(() => {
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    const copyInstead = () => {
      void writeToClipboard(url).then((ok) => settle(ok ? 'copied' : 'failed'));
    };

    if (!canShare) {
      copyInstead();
      return;
    }

    void navigator
      .share({ title, url })
      .then(() => settle('shared'))
      .catch((error: Error) => {
        if (error?.name === 'AbortError') return;
        copyInstead();
      });
  }, [settle, title, url]);

  return { state, share };
}
