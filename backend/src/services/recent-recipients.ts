import type { TransactionStatus, TransactionType } from '@prisma/client';
import { asHandle, payeeHandleOf } from '../lib/payee.js';
import { asAddress, shortenAddress } from './transaction-view.js';
import type { RecentRecipient } from '../types/index.js';

/**
 * Who this account has already paid, so the second payment to them is one tap (#99).
 *
 * Derived from the SAME ledger rows Activity reads, not from a second store: an
 * address book that could disagree with history is a book that will, and the
 * customer would be told they paid somebody they never paid. There is no table, no
 * write path, no cache: one read over rows that already exist.
 *
 * ## What counts as history
 *
 * A person is here because money LEFT the account to them: the two outbound
 * counterparty types only, and only the two statuses that say the send was an
 * attempt the customer made. `pending` and `processing` are excluded on purpose:
 * those may still settle, and a menu that offers to pay again beside a transfer
 * that is still landing invites a double send. `reversed` means the money came
 * back, so the payment did not stand. A `failed` row is included: the person the
 * customer tried to pay is still a person they pay, and Activity already offers
 * that row its own Try again.
 *
 * ## What a name is
 *
 * The name the transfer was made AS, and nothing invented: a merchant's own
 * signed business name, or the handle the customer resolved before signing
 * (`metadata.payee.handle`, #119). With neither, the row's address is the only
 * truth there is, so the label is that address shortened for prose, never a
 * guessed display name, for the same reason Activity never guesses one.
 *
 * ## What the tap targets
 *
 * `handle` when the person has one, so the send flow RE-RESOLVES the name at tap
 * time and the money goes to whoever holds it now. That is the whole mitigation
 * for a name that has changed hands (issue #99's stated risk): the cached name is
 * never trusted as a destination, and the address is a fallback for the rows that
 * only ever had one.
 */

/** How many people the send screen offers. More than a handful is a list nobody reads. */
export const RECENT_RECIPIENT_LIMIT = 5;

/**
 * How many ledger rows the derivation looks through.
 *
 * A window rather than a distinct query: five distinct people can sit behind one
 * person's thirty payments, and stopping at the limit would offer a customer who
 * pays one person weekly a list of one. A hundred rows is a few weeks of ordinary
 * use and one indexed read.
 */
export const RECENT_RECIPIENT_WINDOW = 100;

/** The ledger types where the counterparty is somebody who was paid. */
const PAID_TYPES: readonly TransactionType[] = ['p2p_send', 'payment'];

/** The statuses that make a send an attempt the customer actually made. */
const ATTEMPTED_STATUSES: readonly TransactionStatus[] = ['completed', 'failed'];

/**
 * The database filter, in one place.
 *
 * Scoped by `userId` and `network` because the list is the CALLER's own history on
 * the network the caller is acting on: a practice payment must not offer a live
 * recipient, the same rule Activity and the statement follow. Returning the filter
 * rather than writing it inside the route is what lets the check assert that
 * scoping rather than trusting it.
 */
export function recentRecipientWhere(userId: string, network: string) {
  return {
    userId,
    network,
    type: { in: [...PAID_TYPES] },
    status: { in: [...ATTEMPTED_STATUSES] },
  };
}

/**
 * The ledger fields this derivation needs, and nothing else.
 *
 * Narrow on purpose, like `AnalyticsRow`: a check can build these by hand without a
 * database, and a row that grows a field cannot quietly change how a name is chosen.
 */
export interface RecipientRow {
  type: TransactionType;
  status: TransactionStatus;
  counterparty: string | null;
  createdAt: Date;
  metadata?: unknown;
  merchant?: {
    name: string;
    payoutAddress: string | null;
    handleEntry?: { handle: string } | null;
  } | null;
}

/**
 * The people behind a page of the account's outbound rows, most recent first.
 *
 * Order is the query's (newest first), and the first row for a person is the one
 * kept, so "recent" means when they were last paid, not when they were first. A
 * row with no address at all is dropped rather than offered: the send flow cannot
 * be pointed at nothing.
 *
 * The type and status rules are applied HERE as well as in the filter above, and
 * that is not belt-and-braces: this function is what decides whether a payment may
 * be offered again, so it refuses a row it should never have been handed (a caller
 * that widens the query, a row read by another route) rather than trusting its
 * input. A processing send that was offered here would invite a second payment for
 * money that is still landing.
 */
export function recentRecipients(
  rows: readonly RecipientRow[],
  limit = RECENT_RECIPIENT_LIMIT
): RecentRecipient[] {
  const seenAddresses = new Set<string>();
  const seenHandles = new Set<string>();
  const recipients: RecentRecipient[] = [];

  for (const row of rows) {
    if (recipients.length >= limit) break;
    if (!PAID_TYPES.includes(row.type)) continue;
    if (!ATTEMPTED_STATUSES.includes(row.status)) continue;

    const address = asAddress(row.counterparty) ?? asAddress(row.merchant?.payoutAddress);
    if (!address) continue;

    /**
     * A merchant's handle is the business's own signed name; a person's handle is
     * the one the customer resolved. Both are handles, and the first one present
     * wins, because a merchant payment carries no `payee` metadata. `payeeHandleOf` already
     * refuses anything that is not the handle shape (an address included), so the
     * column's contents cannot be smuggled into a name.
     */
    const handle = asHandle(row.merchant?.handleEntry?.handle) ?? payeeHandleOf(row.metadata);

    /**
     * One row per PERSON, keyed by both ends: the same address paid once by name and
     * once by address is one person (the address is the identity the chain keeps),
     * and a name that has pointed at two addresses over its life is still one name.
     * Either collision means somebody is already offered, so this row adds nothing.
     */
    const addressKey = address.toLowerCase();
    if (seenAddresses.has(addressKey)) continue;
    if (handle && seenHandles.has(handle)) continue;

    seenAddresses.add(addressKey);
    if (handle) seenHandles.add(handle);

    recipients.push({
      name: row.merchant?.name ?? handle ?? shortenAddress(address),
      handle,
      address,
      lastPaidAt: row.createdAt.toISOString(),
    });
  }

  return recipients;
}
