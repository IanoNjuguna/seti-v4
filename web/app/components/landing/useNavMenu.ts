'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseNavMenuReturn } from './useNavMenu.types';

/**
 * The mobile menu's open state, and its two dismissals.
 *
 * Owned by the nav for the same reason `useNavSearch` is: this is chrome, and a
 * band's sections stay free of it. It is a disclosure, not a modal — nothing is
 * trapped, nothing behind it is inert, and the panel is a sibling of its own
 * control so Tab reaches the links with no focus juggling.
 *
 * ESCAPE AND THE OUTSIDE TAP BOTH DISMISS, and they are the only two listeners.
 * The outside tap is a `pointerdown` on the document that is a no-op while the
 * event's target sits inside `containerRef` — the same test that keeps a tap on
 * a panel link from dismissing the menu out from under the navigation the tap is
 * starting. Escape hands focus back to the control, so a keyboard user who was
 * standing on a link when the panel closed does not lose their place to
 * `<body>`.
 *
 * Both listeners are attached only while the panel is open, and this hook holds
 * no listener for the closed state at all.
 */
export function useNavMenu(): UseNavMenuReturn {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const toggle = useCallback(() => setOpen((previous) => !previous), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return { open, toggle, close, containerRef, buttonRef };
}
