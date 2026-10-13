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
 * them nor the close control.
 */
export function ReceiptBody({ card, loading, error, retry, actions }: ReceiptBodyProps) {
  return (
    <>
      {loading ? <ReceiptLoading /> : null}
      {error ? <ReceiptError message={error} onRetry={retry} /> : null}

      {card ? (
        <>
          <ReceiptCard card={card} />
          <ReceiptActions actions={actions} />
        </>
      ) : null}
    </>
  );
}
