import { get } from './client';
import type { RecentRecipientsAnswer } from './recipients.types';

/**
 * Who this account has already paid, for the send screen's repeat entry (#99).
 *
 * Derived by the SERVER from the same ledger rows Activity reads, so the list
 * cannot disagree with the history beside it, and it is scoped to the calling
 * account by the session token, so there is no user id in the request to get wrong.
 *
 * Read fresh each time the flow opens rather than cached in the browser: a name
 * that has since changed hands must not be offered as a destination from a copy,
 * and the tap re-resolves the handle anyway.
 */
export function fetchRecentRecipients(): Promise<RecentRecipientsAnswer> {
  return get<RecentRecipientsAnswer>('/transactions/recipients');
}
