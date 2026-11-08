'use client';

import { BrandMark, Text } from '@/components/ui';
import { RECEIPT_WORDMARK } from './Receipt.constants';

export interface ReceiptLetterheadProps {
  /** Unused by the drawing and kept for its caller's sake: the marking moved out (#431). */
  network?: string;
}

/**
 * The letterhead: the owner's mark and the wordmark. Nothing else.
 *
 * It used to carry `Network: Live` in a bordered chip beside the close button, and on a
 * live receipt that said something it did not mean. `Live` is the product's word for
 * mainnet, not a state the payment is in: the payment settled, and labelling the document
 * `live` beside an amount reads as a claim about the money. It also spent the header's
 * only slot besides the close control, so the eye landed on a deployment label before the
 * wordmark, on the artifact whose whole job is to be identified at a glance.
 *
 * A practice receipt is the one case where the marking earns its place, because a practice
 * receipt and a live one have identical figures and this is the copy that gets forwarded
 * and printed. It is not carried here: `ReceiptSheet` prints `Practice · no real money
 * moved` as a strip above this letterhead, where it is larger than a chip and cannot be
 * cropped off a screenshot by accident.
 *
 * The chain itself, as a fact for someone checking the transfer, belongs to #406: the
 * transaction hash, both ends and the asset, in the receipt's own detail block.
 *
 * The mark is `BrandMark` at `expression="neutral"`, `canvas="dark"`: a document identifies
 * rather than greets, so it wears the identity's default face. Decorative, because the
 * wordmark beside it already names the issuer.
 */
export function ReceiptLetterhead(_props: ReceiptLetterheadProps) {
  return (
    <div className="flex items-center gap-2.5 pr-14">
      <BrandMark expression="neutral" canvas="dark" className="h-7" />
      <Text variant="section" as="span" color="inverse">
        {RECEIPT_WORDMARK}
      </Text>
    </div>
  );
}
