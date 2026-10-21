import type { ReactNode } from 'react';
import type { Transaction } from '@/lib/types';

export interface TransactionRowProps {
  transaction: Transaction;
  /**
   * Named `onSelect` rather than RN's `onPress`: this is a DOM button, and the
   * two events are not the same thing.
   *
   * Optional, and its absence is meaningful: a row that opens nothing (the home
   * card's short list) is not rendered as a control at all. Only Activity makes
   * its rows selectable.
   */
  onSelect?: (transaction: Transaction) => void;
  /**
   * Extra detail rendered inside the row's content column, under the title. The
   * Activity screen passes the indexer's fields; the home card passes nothing and
   * its rows are unchanged.
   */
  details?: ReactNode;
  /**
   * A control that sits beside the row rather than inside it: the Activity list
   * uses it for `Try again` on a failed payment.
   *
   * Beside, not inside, because the row is itself a `<button>` when it is
   * selectable — a button inside a button is invalid HTML, and browsers restructure
   * it rather than honouring it. A sibling cannot fire the row's own handler either,
   * so "does not open the receipt" is structural rather than a `stopPropagation`.
   */
  action?: ReactNode;
}

/** The row's content, rendered by whichever wrapper the row needs. */
export type TransactionRowBodyProps = Pick<TransactionRowProps, 'transaction' | 'details'>;
