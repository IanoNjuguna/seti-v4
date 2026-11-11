'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SWAP_MENU_FOCUSABLE } from './SwapForm.constants';
import type { UseSwapTokenDialogReturn, UseSwapTokenPickerReturn } from './SwapForm.types';

/**
 * Whether the token list is open, and how it closes.
 *
 * State only: opening a list is a decision the CARD makes, and keeping it here means the
 * trigger and the dialog cannot disagree about it. `hide` is stable so the dialog's own
 * effects — which close it on Escape — never re-run and re-focus the trigger mid-interaction.
 */
export function useSwapTokenPicker(): UseSwapTokenPickerReturn {
  const [open, setOpen] = useState(false);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  return { open, show, hide };
}

/**
 * What makes the token list a dialog rather than a panel over the page.
 *
 * The same four things `useReceiptDialog` does, because the app has one modal behaviour
 * (#545): focus moves into the dialog on open, Tab wraps inside it instead of walking into
 * the pair behind, Escape closes it, and focus returns to the control that was pressed —
 * which for a picker is the difference between choosing a token and being dropped at the top
 * of the document. DOM only, so it cannot cascade a render.
 */
export function useSwapTokenDialog(onClose: () => void): UseSwapTokenDialogReturn {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    containerRef.current?.focus();

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [onClose]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const focusable = containerRef.current?.querySelectorAll<HTMLElement>(SWAP_MENU_FOCUSABLE);
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  return { containerRef, onKeyDown };
}
