/**
 * How many rows a page carries.
 *
 * Small enough that the first page paints immediately on a phone connection, large
 * enough that a normal week of spending is one request.
 */
export const ACTIVITY_PAGE_SIZE = 20;

/**
 * Copy for the screen, in one place so its title, its states and its button cannot
 * drift apart.
 */
export const ACTIVITY_COPY = {
  title: 'Activity',
  subtitle: 'Everything that has moved in or out of your account.',
  /** Announced while the first page is in flight, not just drawn as a skeleton. */
  loading: 'Loading your activity',
  emptyTitle: 'No activity yet',
  emptyBody: 'Payments, transfers and deposits will appear here.',
  errorTitle: "Couldn't load your activity",
  retry: 'Try again',
  loadMore: 'Load more',
  loadingMore: 'Loading…',
} as const;
