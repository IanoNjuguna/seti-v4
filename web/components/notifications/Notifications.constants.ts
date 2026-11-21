/**
 * The notifications list's words and its one storage key (#592).
 *
 * READ STATE IS CLIENT-SIDE, AND THAT IS THE HONEST LIMITATION OF V1. The seen instant lives
 * in `localStorage` under SEEN_KEY, so a second device shows every row as new again. The fix
 * is a `notificationsSeenAt` column on the account, which is a schema change and does not
 * belong inside a chrome PR. The list is correct today; the "new" mark is per-device, and
 * saying so here beats someone discovering it later.
 *
 * The path is deliberately NOT restated here. It lives in `lib/routes.ts` beside the other
 * routes, because the bell and the page must never disagree about where the bell goes — and a
 * copy of a path string is exactly how they do.
 */
export const SEEN_KEY = 'seti.notifications.seenAt';

export const NOTIFICATIONS_COPY = {
  title: 'Notifications',
  eyebrow: 'Money that arrived',
  /** The empty state names the cause, so a quiet account is not left guessing. */
  emptyTitle: 'Nothing to show',
  empty: 'Nothing has arrived yet. When money lands at one of your addresses it shows up here.',
  loading: 'Reading your arrivals.',
  failedTitle: 'Could not read',
  failed: 'Your arrivals could not be read just now. Nothing is lost; the list reloads.',
  retry: 'Try again',
  newMark: 'New',
  matched: 'Matched to a charge',
  unmatched: 'No charge behind it',
} as const;

/** How many arrivals the list asks for. One page, no infinite scroll in v1. */
export const ARRIVAL_LIMIT = 20;
