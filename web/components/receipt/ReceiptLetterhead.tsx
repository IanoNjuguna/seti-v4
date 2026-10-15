'use client';

import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Network } from '@/lib/network';
import { RECEIPT_COPY, RECEIPT_MARK_SRC, RECEIPT_WORDMARK } from './Receipt.constants';

export interface ReceiptLetterheadProps {
  /** Which network the receipt is from — the one thing that decides its treatment. */
  network: Network;
  /** The network's product word, as the document carries it. */
  networkLabel: string;
}

/**
 * The letterhead: the owner's mark, the wordmark, and the NETWORK.
 *
 * Kept on the card on purpose. The card is held up to a merchant as proof, and
 * the mark is what makes it read as an issued document rather than a screenshot
 * of a number. It carries no data about the customer — brand and network only.
 *
 * The network belongs here, at the head of the document, because a practice
 * receipt and a live one differ ONLY by which chain they happened on: the figures
 * have the same shape. Naming it on the card — and in every export — is what makes
 * a shared link unambiguous.
 *
 * A PRACTICE receipt wears the same mark in the warning orange the app marks
 * practice with everywhere else (`Text color="attention"`), where a live one is
 * quiet white-on-black. This is the copy of the card that leaves the app: it is
 * forwarded, screenshotted and printed, and a practice payment that looked
 * identical to a live one on the artifact that travels furthest would undo the
 * point of marking it at all. The colour is never the only signal — the word is
 * inside the box.
 */
export function ReceiptLetterhead({ network, networkLabel }: ReceiptLetterheadProps) {
  const practice = network === 'testnet';

  return (
    <div className="flex items-center justify-between gap-3 pr-14">
      <div className="flex items-center gap-2.5">
        {/* Decorative: the wordmark beside it already names the issuer. */}
        <img src={RECEIPT_MARK_SRC} alt="" className="h-7 w-auto" />
        <Text variant="section" as="span" color="inverse">
          {RECEIPT_WORDMARK}
        </Text>
      </div>

      <span
        className={cn(
          'rounded-sm px-2 py-0.5 ring-1',
          practice ? 'ring-accent-warning' : 'ring-on-dark/30'
        )}
      >
        <Text variant="micro" as="span" color={practice ? 'attention' : 'inverse'}>
          {`${RECEIPT_COPY.networkPrefix} ${networkLabel}`}
        </Text>
      </span>
    </div>
  );
}
