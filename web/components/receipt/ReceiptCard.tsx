'use client';

import { ReceiptChain } from './ReceiptChain';
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
 * The block, each token movement and the raw receipt stay off the card: that is the audit view,
 * and it is one tap away. The HASH does not (#406). #407 took the indexer strip off every Activity
 * row, which was right, and the transaction hash then appeared nowhere in the product at all — so
 * a customer with a transfer to check against the chain had nothing to check it with. `ReceiptChain`
 * prints the hash, both ends and the asset, in full, and the text export carries the same block.
 *
 * That does widen what a shared receipt shows, and it is a considered trade: the document is a
 * capability the customer hands out deliberately, and a receipt that cannot be used to look a
 * payment up is not proof of anything.
 *
 * The QR is the one affordance on the document itself: it carries exactly the
 * link the Share action hands out, so a merchant can scan the card instead of
 * being sent a link. `shareUrl` is absent while the link is minting, and the card
 * is complete without it.
 */
export function ReceiptCard({ card, shareUrl }: ReceiptCardProps) {
  return (
    <article className="text-on-dark">
      <ReceiptLetterhead network={card.network} />
      <ReceiptFigure
        word={card.word}
        figure={card.figure}
        assetLine={card.assetLine}
        titleId={RECEIPT_TITLE_ID}
      />
      <ReceiptPartyLine party={card.party} />
      <ReceiptWhen dateTime={card.dateTime} status={card.status} />
      {card.chain ? <ReceiptChain chain={card.chain} /> : null}
      <ReceiptFooter fee={card.fee} explorerUrl={card.explorerUrl} />
      {shareUrl ? <ReceiptQr value={shareUrl} /> : null}
    </article>
  );
}
