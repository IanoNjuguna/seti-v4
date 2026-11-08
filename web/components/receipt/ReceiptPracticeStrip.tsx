import { RECEIPT_COPY } from './Receipt.constants';

/**
 * The practice marking: the one banner a receipt carries, and the only network fact it prints
 * (#431).
 *
 * A practice receipt and a live one have identical figures, and this is the copy of the
 * document that leaves the app: forwarded, screenshotted, printed, and held up to a merchant
 * as proof. A chip in the letterhead was the old treatment, four words in the smallest type
 * the system has, in the slot beside the close button. A strip is larger than a chip, sits
 * inside the card's own radius so it prints as part of the document, and cannot be cropped
 * out of a screenshot without taking the amount with it.
 *
 * `bg-accent-warning` with `canvas-dark` on it is the app's practice pairing. Measured: the
 * ink is **7.55:1** on the fill `#ec7e00`, and white would be 2.78:1, so the label is ink and
 * not white. A solid band is the one treatment that survives being photographed at an angle on
 * a counter.
 *
 * Not hidden from print, deliberately. A printed practice receipt that lost its marking would
 * be a document claiming money moved when it did not.
 */
export function ReceiptPracticeStrip() {
  return (
    <p
      role="note"
      className="bg-accent-warning px-6 py-2 text-caption font-semibold text-canvas-dark"
    >
      {RECEIPT_COPY.practiceNote}
    </p>
  );
}
