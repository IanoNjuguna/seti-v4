'use client';

import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { ReceiptBody } from './ReceiptBody';
import { RECEIPT_COPY, RECEIPT_TITLE_ID } from './Receipt.constants';
import { useReceipt } from './useReceipt';
import { useReceiptActions } from './useReceiptActions';
import { useReceiptCard } from './useReceiptCard';
import { useReceiptDialog } from './useReceiptDialog';
import { useReceiptLink } from './useReceiptLink';
import type { ReceiptSheetProps } from './Receipt.types';

/**
 * The receipt, as a sheet on a phone and a centred dialog from `sm` up.
 *
 * Rendered through a portal on purpose: it is a document, so for print it has to be
 * the only thing in the flow. A portal makes it a direct child of `<body>`, which
 * is what lets the print stylesheet remove the rest of the page from the layout
 * instead of merely hiding it — hiding leaves the activity list pushing the
 * receipt onto a second sheet of paper.
 *
 * The card is sized to fit; `overflow-y-auto` is only the guard for a receipt
 * taller than any we expect (an unusually long merchant name, plus the QR), so a
 * normal one shows no scrollbar and nothing is clipped to avoid one.
 */
export function ReceiptSheet({ transactionId, onClose }: ReceiptSheetProps) {
  const { containerRef, onKeyDown } = useReceiptDialog(onClose);
  const { receipt, loading, error, retry } = useReceipt(transactionId);
  const card = useReceiptCard(receipt);
  // The one link this surface hands out: the card draws its QR and the Share
  // action sends it, so both are the SAME link by construction.
  const { shareUrl } = useReceiptLink(transactionId);
  const actions = useReceiptActions(receipt, card?.currency ?? null, shareUrl);

  return createPortal(
    <div
      data-receipt-overlay=""
      className="fixed inset-0 z-50 flex items-end justify-center bg-canvas-dark/70 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={RECEIPT_TITLE_ID}
        tabIndex={-1}
        data-receipt-print=""
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-canvas-dark text-on-dark focus:outline-none sm:rounded-lg"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={RECEIPT_COPY.close}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-on-dark-mute transition-colors hover:bg-surface-elevated hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark/60 print:hidden"
        >
          <Icon name="close" />
        </button>

        <div className="px-6 pb-6 pt-6">
          <ReceiptBody
            card={card}
            loading={loading}
            error={error}
            retry={retry}
            actions={actions}
            shareUrl={shareUrl}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
