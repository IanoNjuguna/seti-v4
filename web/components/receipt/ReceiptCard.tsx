'use client';

import { ReceiptFigure } from './ReceiptFigure';
import { ReceiptFooter } from './ReceiptFooter';
import { ReceiptLetterhead } from './ReceiptLetterhead';
import { ReceiptPartyLine } from './ReceiptPartyLine';
import { ReceiptWhen } from './ReceiptWhen';
import { RECEIPT_TITLE_ID } from './Receipt.constants';
import type { ReceiptCardProps } from './Receipt.types';

/**
 * The proof of payment: figure, who, when, one fee line, the way to the chain.
 *
 * Everything an explorer would show about the transaction — the block, the
 * sender, each token movement, the hash — is deliberately absent. That is the
 * audit view, and it is one tap away on the explorer; on the card it would be
 * noise to the person the card is shown to, and detail about the customer that
 * an onlooker has no business reading.
 */
export function ReceiptCard({ card }: ReceiptCardProps) {
  return (
    <article className="text-on-dark">
      <ReceiptLetterhead />
      <ReceiptFigure word={card.word} figure={card.figure} titleId={RECEIPT_TITLE_ID} />
      <ReceiptPartyLine party={card.party} />
      <ReceiptWhen dateTime={card.dateTime} status={card.status} />
      <ReceiptFooter fee={card.fee} explorerUrl={card.explorerUrl} />
    </article>
  );
}
