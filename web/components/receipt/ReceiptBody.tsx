'use client';

import { ReceiptActions } from './ReceiptActions';
import { ReceiptCard } from './ReceiptCard';
import { ReceiptError, ReceiptLoading } from './ReceiptStates';
import type { ReceiptBodyProps } from './Receipt.types';

/**
 * The card, in whichever of its three states it is in.
 *
 * The exports sit below the card rather than inside it: they are affordances of
 * the screen, not part of the document, and a printed receipt carries neither
 * them nor the close control. The QR, by contrast, IS part of the card (`ReceiptCard`)
 * because it is the document's own way out — a merchant scans it, and it prints.
 */
export function ReceiptBody({ card, loading, error, retry, actions, shareUrl }: ReceiptBodyProps) {
  return (
    <>
      {loading ? <ReceiptLoading /> : null}
      {error ? <ReceiptError message={error} onRetry={retry} /> : null}

      {card ? (
        <>
          <ReceiptCard card={card} shareUrl={shareUrl} />
          <ReceiptActions actions={actions} />
        </>
      ) : null}
    </>
  );
}
