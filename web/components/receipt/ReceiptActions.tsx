'use client';

import { RECEIPT_COPY } from './Receipt.constants';
import type { ReceiptActionsProps } from './Receipt.types';

/**
 * The four ways out of the receipt. Same size, same weight — the customer picks
 * the format they need, and none of them is the "right" one.
 *
 * The confirmation is a live region rather than a toast: it is the answer to a
 * press, it belongs next to the button that was pressed, and a screen reader
 * announces it without moving focus.
 */
const ACTION_BUTTON =
  'flex-1 rounded-full bg-surface-elevated px-3 py-2.5 text-body-sm font-semibold text-on-dark transition-colors hover:bg-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark/60';

export function ReceiptActions({ actions }: ReceiptActionsProps) {
  return (
    // A screen affordance, not part of the document: a printed receipt should not
    // carry its own download buttons, for the same reason it should not carry the
    // close control.
    <section className="mt-6 print:hidden">
      <div className="flex gap-2">
        <button type="button" className={ACTION_BUTTON} onClick={actions.share}>
          {RECEIPT_COPY.share}
        </button>
        <button type="button" className={ACTION_BUTTON} onClick={actions.downloadPdf}>
          {RECEIPT_COPY.pdf}
        </button>
        <button type="button" className={ACTION_BUTTON} onClick={actions.downloadTxt}>
          {RECEIPT_COPY.txt}
        </button>
        <button type="button" className={ACTION_BUTTON} onClick={actions.downloadJson}>
          {RECEIPT_COPY.json}
        </button>
      </div>

      <p aria-live="polite" className="mt-2 min-h-5 text-caption text-on-dark-mute">
        {actions.status ?? ''}
      </p>
    </section>
  );
}
