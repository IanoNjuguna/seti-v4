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
   * A control that sits OVER the row's reserved strip rather than inside the row's
   * own control: the Activity list uses it for `Try again` on a failed payment.
   *
   * Not inside, because the row is itself a `<button>` when it is selectable — a
   * button inside a button is invalid HTML, and browsers restructure it rather than
   * honouring it. Positioned over the strip and beside the button in the tree, so
   * "does not open the receipt" is structural rather than a `stopPropagation`.
   *
   * The action adds a strip under the row's content (`pb-12`), aligned with the name
   * column. At 360px an action at the row's trailing edge squeezed the content
   * column until the amount was clipped; this layout leaves the amount's column
   * exactly as wide as it is on a row with no action.
   */
  action?: ReactNode;
}

/** The row's content, rendered by whichever wrapper the row needs. */
export type TransactionRowBodyProps = Pick<TransactionRowProps, 'transaction' | 'details'>;
