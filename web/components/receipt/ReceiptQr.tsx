'use client';

import { QrPlate } from '@/components/qr/QrPlate';
import { RECEIPT_COPY } from './Receipt.constants';
import type { ReceiptQrProps } from './Receipt.types';

/**
 * The shareable link, as a code the other party can scan.
 *
 * The card is held up to a merchant, and the fastest way in is a camera, so the card carries the
 * SAME link the Share action hands out, encoded exactly, never a second payload. It is part of the
 * document rather than a screen affordance, and so it prints: a QR survives on paper where a "Copy
 * link" button does not.
 *
 * It draws through `QrPlate`, the app's one branded code (#432): level H, the mark in a cleared
 * well, a four-module quiet zone inside the SVG, and modules that keep their full dark area. This
 * surface used to draw its own through `react-qr-code` at level M with no mark, which was the wrong
 * side of two decisions. M corrects 15% where the plate's well erases about 12% of the symbol, so
 * no mark could be added to it. And `react-qr-code` emits one `<path>` per dark module, so there was
 * no way to reserve the centre even if the level had allowed it.
 *
 * The width is `12.5rem` (200px) rather than the plate's default 20rem: a receipt is a column of
 * text and the code must not become the loudest object on the document. At level H a share link is
 * 37 modules including the quiet zone, so 200px is ~5.4px per module against the ~3.7px the old
 * 136px tile would have given the same payload at H. The marking costs nothing in scanability.
 */
export function ReceiptQr({ value }: ReceiptQrProps) {
  return (
    <figure className="mt-6 flex flex-col items-center gap-3 border-t border-hairline-dark pt-5">
      <QrPlate value={value} title={RECEIPT_COPY.qrCaption} width="12.5rem" tone="light" />
      <figcaption className="text-caption text-on-dark-mute">{RECEIPT_COPY.qrCaption}</figcaption>
    </figure>
  );
}
