'use client';

import { Text } from '@/components/ui';
import { RECEIPT_MARK_SRC, RECEIPT_WORDMARK } from './Receipt.constants';

/**
 * The letterhead: the owner's mark and wordmark.
 *
 * Kept on the card on purpose. The card is held up to a merchant as proof, and
 * the mark is what makes it read as an issued document rather than a screenshot
 * of a number. It carries no data about the customer — brand only.
 */
export function ReceiptLetterhead() {
  return (
    <div className="flex items-center gap-2.5 pr-14">
      {/* Decorative: the wordmark beside it already names the issuer. */}
      <img src={RECEIPT_MARK_SRC} alt="" className="h-7 w-auto" />
      <Text variant="section" as="span" color="inverse">
        {RECEIPT_WORDMARK}
      </Text>
    </div>
  );
}
