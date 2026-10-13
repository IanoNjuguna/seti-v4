'use client';

import { useMemo } from 'react';
import { ReceiptCard } from '@/components/receipt/ReceiptCard';
import { ReceiptLoading } from '@/components/receipt/ReceiptStates';
import { deriveReceiptCard } from '@/components/receipt/receipt.card';
import { useMounted } from '@/hooks/useMounted';
import type { ReceiptPublicViewProps } from './ReceiptPublicView.types';

/**
 * The shared receipt, drawn on a dark tile that matches the owner's own sheet.
 *
 * This is the SAME `ReceiptCard` the modal shows — figure, payee, date, status,
 * one fee line, explorer link, and the QR — not a second rendering of the
 * document. Being shareable is the point of this page, so it must show what the
 * owner sees, and the only way to guarantee that is to draw the same component.
 *
 * The card is drawn only after mount. Every figure on it is formatted for the
 * reader's locale and timezone (`formatReceiptDateTime`), and the QR's value is
 * the reader's own origin — neither exists on the server, so rendering during SSR
 * would produce a string the browser then hydrates against. `useMounted` defers
 * the whole card to the client in one pass; signed out it still renders, which is
 * what makes the link worth sending.
 *
 * The QR encodes this page's own link: `${origin}/r/<id>?t=<token>`, the exact
 * string in the address bar, so scanning what is on screen opens the same receipt.
 */
export function ReceiptPublicView({ receipt, receiptId, token }: ReceiptPublicViewProps) {
  const mounted = useMounted();
  const card = useMemo(() => deriveReceiptCard(receipt, null), [receipt]);
  const shareUrl = useMemo(
    () => (mounted ? `${window.location.origin}/r/${receiptId}?t=${token}` : null),
    [mounted, receiptId, token]
  );

  if (!mounted || shareUrl === null) {
    return (
      <div className="rounded-lg bg-canvas-dark p-6">
        <ReceiptLoading />
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-canvas-dark p-6">
      <ReceiptCard card={card} shareUrl={shareUrl} />
    </div>
  );
}
