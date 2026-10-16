import type { MoneyRow } from './MoneySection.types';

/**
 * What the dollars are for. Two answers, in the order people ask them: where can
 * I spend it, and can I send it to someone.
 *
 * It used to carry a third — "Keep the rest" / "The dollars stay in your balance
 * until you spend them." — deleted by the owner, which leaves this column two
 * rows shorter than the prose beside it. See `MoneySection` for how the band is
 * balanced around that.
 */
export const MONEY_ROWS: MoneyRow[] = [
  {
    label: 'Pay in a shop',
    detail: 'Show your code, or type the shop’s name.',
  },
  {
    label: 'Send to a person',
    detail: 'No long numbers to copy. A name is enough.',
  },
];
