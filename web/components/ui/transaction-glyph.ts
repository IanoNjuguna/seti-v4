import type { Transaction } from '@/lib/types';
import type { TransactionGlyph } from './TransactionRow.types';

/**
 * The mark a row wears (#409): what happened, in one glyph.
 *
 * ## Why a glyph and not a letter
 *
 * The circle used to carry the first letter of the title, so a page of transfers read `S S R S S`: a
 * column of letters that were not names, on rows that had no name to show. A glyph says which of six
 * things happened without a word, and it repeats meaningfully rather than identically.
 *
 * ## The vocabulary, and what earns a mark
 *
 * Every entry is a primitive the hand-drawn set already had, or one added for this and nothing else:
 * an arrow out for money leaving, its mirror for money arriving, a plus for a deposit, opposing arrows
 * for a swap, a clock for a row still in flight. ANY row with a name behind it keeps the initial — a
 * merchant's name, or the claimed username the send flow resolved — because that one IS a name and an
 * initial is what a name reduces to at 40px. Only a row titled by a verb takes the arrow.
 *
 * A failed row wears `alert` and a pending one wears `clock`, whatever its type: a row that has not
 * happened is not yet a transfer, and the glyph is the first thing read.
 */
const GLYPH_BY_TYPE: Record<string, TransactionGlyph> = {
  payment: 'send',
  p2p_send: 'send',
  p2p_receive: 'arrowDownLeft',
  top_up: 'add',
  convert: 'swap',
  withdrawal: 'send',
  /*
   * No `fee` entry (#411). The 2% never becomes a ledger row: it rides inside the payment's own
   * transfer and is stored as `feeAmount` on that row, so a `fee` row is a shape the schema allows and
   * nothing writes. A glyph for it was a mark nothing would ever wear.
   */
};

/**
 * The titles the server gives a row with no name behind it.
 *
 * Held here as well as on the server for one decision: whether the circle should draw an initial. A
 * `payment` whose title is `Payment` is a payment to a wallet we cannot name, and drawing `P` for it
 * would be the letter-column problem again. Kept as a literal list rather than a shared module because
 * the server's copy is inside a service and the client must not import the ledger.
 */
const ANONYMOUS_TITLES = new Set(['Payment', 'Sent', 'Received', 'Deposit', 'Withdrawal', 'Fee', 'Convert']);

/** `@akinyi` reduces to `A`; a merchant's `Java House` to `J`. */
export function initialOf(name: string): string {
  const letter = name.replace(/^@+/, '').trim().charAt(0);
  return letter ? letter.toUpperCase() : '?';
}

export interface RowGlyph {
  /** `null` means "draw the merchant's initial in the circle instead". */
  icon: TransactionGlyph | null;
  /**
   * The circle's tint. Money in takes the success role; everything else stays the quiet surface, so the
   * one green circle on a page means received money and nothing else.
   */
  tone: 'quiet' | 'in';
}

export function rowGlyph(transaction: Transaction): RowGlyph {
  const { type, direction, status, merchant } = transaction;

  if (status === 'failed') return { icon: 'alert', tone: 'quiet' };
  if (status === 'pending') return { icon: 'clock', tone: 'quiet' };

  const named = Boolean(merchant) && !ANONYMOUS_TITLES.has(merchant);
  if (named) return { icon: null, tone: 'quiet' };

  const icon = type ? GLYPH_BY_TYPE[type] : undefined;
  if (icon) return { icon, tone: receives(icon) ? 'in' : 'quiet' };

  // No ledger type on the payload (an older row): the direction is still true.
  return direction === 'in' ? { icon: 'arrowDownLeft', tone: 'in' } : { icon: 'send', tone: 'quiet' };
}

/** Money arriving is the only thing that earns the success tint. */
function receives(icon: TransactionGlyph): boolean {
  return icon === 'arrowDownLeft' || icon === 'add';
}
