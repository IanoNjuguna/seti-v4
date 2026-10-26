import type { ConvertQuote } from '@/lib/api/convert';

/**
 * Where a swap is.
 *
 * `moved` is not a state: a re-quote that pays less than the figure the customer
 * tapped lands back in `idle` with a fresh `quote` and the `moved` sentence, so the
 * next tap confirms the figure they can actually read.
 */
export type ConvertSwapStep =
  | 'idle'
  /** Re-asking the book at the moment of signing. */
  | 'quoting'
  /** The wallet is signing the Tempo transaction. */
  | 'signing'
  /** Signed and broadcast; the receipt is being verified and written up. */
  | 'recording'
  | 'done'
  | 'error';

export interface ConvertSwapState {
  step: ConvertSwapStep;
  /**
   * The quote the confirm step is showing: the gate's, until a re-quote replaces it.
   *
   * Held here rather than in the component so there is ONE figure on screen — a moved
   * price cannot leave the old line beside the new one, or a customer confirming a
   * number nobody priced.
   */
  quote: ConvertQuote | null;
  /** Signed and broadcast. Present from `recording` onwards, and on a record failure. */
  txHash: string | null;
  /** One sentence, in our own words. Null when nothing has gone wrong. */
  error: string | null;
}

export interface UseConvertSwapReturn extends ConvertSwapState {
  /** True while anything is in flight. Terminal states are not busy. */
  busy: boolean;
  /**
   * Sign and record the swap the customer just confirmed.
   *
   * `shown` is the quote on screen. A FRESH one is fetched first, so the quote id that
   * reaches the record path is seconds old rather than minutes, and the floor that is
   * signed is the floor of the quote the book will honour. If the fresh floor is lower
   * than the shown one, nothing is signed: the new figure is returned in the state and
   * the customer confirms again.
   */
  confirm: (shown: ConvertQuote) => Promise<void>;
  /** Back to `idle`, for a row that is being put away. */
  reset: () => void;
}
