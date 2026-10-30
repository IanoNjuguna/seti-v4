import type { FeeRow } from './FeesSection.types';

/**
 * The whole price list.
 *
 * THE PRICE IS THE SAME AND IS STATED ONCE. 2% of each payment, no monthly fee, no
 * minimum, with no floor and no cap, charged the same on a small ticket as on a
 * large one. The rows exist as three because two of them say what is NOT charged,
 * which is the question a reader actually has after the word "fee".
 *
 * THE FIRST ROW'S DETAIL IS THE MERCHANT'S SENTENCE. The fee is attributed to the
 * merchant but FUNDED BY THE PAYER inside their own transfer
 * (`backend/src/services/fees.ts` is the source of truth there). "Your customer pays
 * it" is exactly right for a business and nonsense for a person who has no customers,
 * which is why the row used to have a second wording; with one reading on the page
 * (`HeroCopy.constants.ts`) the merchant's row is the row. The fact is identical
 * either way; only the noun ever changed.
 *
 * The figure appears twice in the band, and both times it is the same 2%: once as
 * the price and once inside "Small payments are charged the same 2%", which is
 * what makes "No minimum" a claim rather than a slogan. That repetition is the
 * owner's copy and it is doing work.
 */
export const FEE_COPY: FeeRow[] = [
  {
    label: '2% of each payment',
    detail: 'Your customer pays it, in the same payment.',
  },
  {
    label: 'No monthly fee',
    detail: 'Holding dollars costs you nothing.',
  },
  {
    label: 'No minimum',
    detail: 'Small payments are charged the same 2%.',
  },
];
