'use client';

import { useCallback, useEffect, useRef } from 'react';
import { RECEIPT_FOCUSABLE_SELECTOR } from './Receipt.constants';
import type { UseReceiptDialogReturn } from './Receipt.types';

/**
 * What makes the sheet a dialog rather than a panel that covers the page.
 *
 * Four things, and all four are the difference between a modal and a div:
 * focus moves into the dialog on open, Tab wraps inside it instead of wandering
 * into the page behind, Escape closes it, and focus returns to the control the
 * customer actually pressed on close. Nothing here writes React state — it is
 * DOM only, so it cannot cascade a render.
 */
export function useReceiptDialog(onClose: () => void): UseReceiptDialogReturn {
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

    const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
      RECEIPT_FOCUSABLE_SELECTOR
    );
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
