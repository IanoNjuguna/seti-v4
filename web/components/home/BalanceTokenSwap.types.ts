import type { ConvertQuote } from '@/lib/api/convert';

/**
 * The control a balance row offers when the book can fill it.
 *
 * `offer` is the whole gate: null means the live quote was refused, the book has no
 * order the balance can reach, or there is no balance to convert — and the control is
 * then ABSENT rather than disabled. That is the point of #240: a token whose book is
 * empty shows no button at all, because USDT0 has had a live book and has had none, and
 * a permanently disabled button commits to a feature the book may never provide.
 */
export interface BalanceTokenSwapProps {
  /** The row's live quote, or null when there is nothing to offer. */
  offer: ConvertQuote | null;
  /**
   * Called once a swap has been RECORDED, so the card can re-read the balances.
   *
   * Not called on a signature: a swap that was broadcast and refused by the ledger
   * leaves the balance changed too, but that path shows its own sentence and the
   * customer is owed the hash rather than a silent refresh.
   */
  onSwapped?: () => void;
}

/**
 * The action itself, which only exists for a quote the row has already been GIVEN.
 *
 * A separate component from the gate so that the refused path runs no hook at all: no
 * request, no wallet lookup, no state. `Offer` is required here, which is what makes the
 * absence decision impossible to lose track of.
 */
export interface BalanceTokenSwapActionProps {
  offer: ConvertQuote;
  onSwapped?: () => void;
}

/**
 * The confirm step, which exists only for a quote the customer has opened.
 *
 * Every figure is the server's: `quote` is either the gate's own quote or a fresher one
 * fetched at the moment of signing, and this component never derives an amount.
 */
export interface BalanceTokenSwapConfirmProps {
  quote: ConvertQuote;
  /** A quote, signature or record is in flight. */
  busy: boolean;
  /** One sentence, in our words, when something went wrong. */
  error: string | null;
  /** The swap is signed, mined and recorded: there is nothing left to confirm. */
  done: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
