import type { FeeRow } from './FeesSection.types';

/**
 * The whole price list. Two of the three rows exist to say what is NOT charged,
 * which is the question a merchant actually has after the word "fee".
 */
export const FEE_ROWS: FeeRow[] = [
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
