'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UseNavSearchReturn } from './useNavSearch.types';

/**
 * The ⌘K / Ctrl-K palette, owned by the nav.
 *
 * The shortcut is registered once for the whole document rather than per
 * element, and `preventDefault` keeps the browser's own find dialog out of the
 * way. State changes only from the listener, never from an effect body.
 */
export function useNavSearch(): UseNavSearchReturn {
  const [open, setOpen] = useState(false);

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setOpen((previous) => !previous);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, openSearch, closeSearch };
}
