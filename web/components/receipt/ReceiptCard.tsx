'use client';

import { ReceiptFigure } from './ReceiptFigure';
import { ReceiptFooter } from './ReceiptFooter';
import { ReceiptLetterhead } from './ReceiptLetterhead';
import { ReceiptPartyLine } from './ReceiptPartyLine';
import { ReceiptQr } from './ReceiptQr';
import { ReceiptWhen } from './ReceiptWhen';
import { RECEIPT_TITLE_ID } from './Receipt.constants';
import type { ReceiptCardProps } from './Receipt.types';

/**
 * The proof of payment: figure, who, when, one fee line, the way to the chain,
 * and — when the owner has one to hand over — the QR of the shareable link.
 *
 * Everything an explorer would show about the transaction — the block, the
 * sender, each token movement, the hash — is deliberately absent. That is the
 * audit view, and it is one tap away on the explorer; on the card it would be
 * noise to the person the card is shown to, and detail about the customer that
 * an onlooker has no business reading.
 *
 * The QR is the one affordance on the document itself: it carries exactly the
 * link the Share action hands out, so a merchant can scan the card instead of
 * being sent a link. `shareUrl` is absent while the link is minting, and the card
 * is complete without it.
 */
export function ReceiptCard({ card, shareUrl }: ReceiptCardProps) {
  return (
    <article className="text-on-dark">
      <ReceiptLetterhead network={card.network} networkLabel={card.networkLabel} />
      <ReceiptFigure word={card.word} figure={card.figure} titleId={RECEIPT_TITLE_ID} />
      <ReceiptPartyLine party={card.party} />
      <ReceiptWhen dateTime={card.dateTime} status={card.status} />
      <ReceiptFooter fee={card.fee} explorerUrl={card.explorerUrl} />
      {shareUrl ? <ReceiptQr value={shareUrl} /> : null}
    </article>
  );
}
