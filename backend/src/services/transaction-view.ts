import type { RecentTransaction, TransactionStatus } from '../types/index.js';
import { payeeHandleOf } from '../lib/payee.js';

/**
 * How a ledger row becomes something a person reads.
 *
 * Extracted from `getHomeDashboard` when the Activity screen was built: the home
 * card's short list and the full history are the SAME rows, and a second copy of
 * this naming would let the two disagree about what a transfer is called — the row
 * on the card saying "Sent to 0x1234…abcd" while Activity calls it something else.
 * One implementation, two callers.
 */

/**
 * Which way the money moved.
 *
 * Derived from the ledger's own type, in ONE place, so the sign and the colour on
 * every surface come from the same table. Without it the row had to guess, and the
 * guess it made was "everything is an outflow" — so a deposit rendered as
 * `-USD 1,000,000.00` in ink instead of `+` in green.
 */
const INFLOW_TYPES = new Set(['top_up', 'p2p_receive']);

export function directionOf(type: string): 'in' | 'out' {
  return INFLOW_TYPES.has(type) ? 'in' : 'out';
}

/**
 * What an activity row calls a transfer with no merchant behind it.
 *
 * A raw 42-character address overflows the row and gives its avatar letter "0",
 * which says nothing — so the address is shortened for prose, the same 6+4 shape
 * the send panel shows. The full address stays on the row itself, which is where
 * anyone checking a transfer will look anyway.
 *
 * `description` wins when the caller supplied one: a send can carry a note, and a
 * note is a better row title than any address.
 *
 * The ZERO address is not a sender at all — it is a mint, which is what every
 * faucet credit and deposit looks like on chain. Shortening it produced a row
 * titled "0x0000…0000" with an avatar reading "0", so it falls through to the
 * type's own name instead: a deposit says "Deposit".
 */
export function describeCounterparty(transaction: {
  type: string;
  counterparty: string | null;
  description: string | null;
}): string {
  if (transaction.description) return transaction.description;

  const address = transaction.counterparty;
  if (address && !/^0x0{40}$/i.test(address) && /^0x[a-fA-F0-9]{40}$/.test(address)) {
    const short = shortenAddress(address);
    return transaction.type === 'p2p_send' ? `Sent to ${short}` : short;
  }

  if (address && !/^0x0{40}$/i.test(address)) return address;

  return TYPE_LABELS[transaction.type] ?? 'Unknown';
}

/**
 * The row's second line. Ledger vocabulary (`p2p_send`, `top_up`) is the
 * database's, not a customer's — this is the translation.
 */
const TYPE_LABELS: Record<string, string> = {
  payment: 'Payment',
  p2p_send: 'Transfer',
  p2p_receive: 'Transfer',
  top_up: 'Deposit',
  withdrawal: 'Withdrawal',
  fee: 'Fee',
  /**
   * One stablecoin exchanged for another. The row reads as what the customer now
   * holds, so the label names the act rather than a counterparty that does not
   * exist. The sign and the two-figure treatment (in and out on one row) are not
   * this slice: `INFLOW_TYPES` is unchanged, which renders a convert as an
   * outflow of the amount that ARRIVED until the renderer learns the pair.
   */
  convert: 'Convert',
};

export function describeType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/**
 * An address, shortened for prose: `0x1234…abcd`.
 *
 * Same 6+4 shape the send panel and every other row use, so one address is never
 * written two ways on two surfaces. The full value stays beside it wherever the
 * customer might check it.
 */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * A stored value as an address, or null when it is not one.
 *
 * `counterparty` holds whatever the caller supplied — a wallet address, a phone,
 * a merchant id — so it has to be tested rather than assumed. The zero address is
 * excluded too: it is a mint, not a sender, and printing it as one end of a
 * transfer names a party that does not exist.
 */
export function asAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^0x0{40}$/i.test(value)) return null;
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? value : null;
}

/**
 * Both ends of the transfer, from the ledger's point of view.
 *
 * The customer's own wallet is one end; the counterparty (or, for a merchant
 * payment, the merchant's payout address) is the other. Which is `from` and which
 * is `to` follows the direction, and an unknown end stays null rather than being
 * filled with a guess.
 */
function endsOf(row: {
  type: string;
  counterparty: string | null;
  wallet?: { address: string } | null;
  merchant?: { payoutAddress: string | null } | null;
}): { from: string | null; to: string | null } {
  const wallet = asAddress(row.wallet?.address);
  const other = asAddress(row.counterparty) ?? asAddress(row.merchant?.payoutAddress);

  return directionOf(row.type) === 'out' ? { from: wallet, to: other } : { from: other, to: wallet };
}

/** A stored row, in the shape both the dashboard and Activity render. */
export function toRecentTransaction(row: {
  id: string;
  type: string;
  amount: unknown;
  fiatAmount: unknown;
  fiatCurrency: string | null;
  counterparty: string | null;
  description: string | null;
  createdAt: Date;
  status: string;
  asset: string;
  txHash: string | null;
  wallet?: { address: string } | null;
  merchant?: { name: string; category: string | null; payoutAddress: string | null } | null;
  /** Untyped Json on the row; the payee's name is read out of it defensively. */
  metadata?: unknown;
}): RecentTransaction {
  return {
    id: row.id,
    merchant: row.merchant?.name ?? describeCounterparty(row),
    direction: directionOf(row.type),
    category: row.merchant?.category ?? describeType(row.type),
    amount: row.amount?.toString() ?? '0',
    fiatAmount: row.fiatAmount?.toString() ?? null,
    fiatCurrency: row.fiatCurrency,
    date: row.createdAt,
    status: row.status as TransactionStatus,
    txHash: row.txHash,
    asset: row.asset,
    /**
     * The name this person was resolved from, when the row has one.
     *
     * An address cannot be resolved back to a name, so this is the only way a
     * failed row can offer to pay the same person again (#119). Null on every row
     * written before it existed, on a merchant payment, and on a send whose
     * client declared no name — all of which must read as "no payee", not as an
     * error.
     */
    payeeHandle: payeeHandleOf(row.metadata),
    ...endsOf(row),
  };
}
