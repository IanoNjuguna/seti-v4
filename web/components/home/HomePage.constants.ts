/**
 * The home page's own words.
 *
 * The PAGE carries every word on Home (the rule the surface was rebuilt for): the
 * actions (`HomeActions.constants.ts`), and the two sections under the balance here.
 *
 * The section headings live here rather than inside the components for the same
 * reason `/app/receive` splits its copy from its halves: the components carry
 * objects, the page names them.
 */
export const HOME_PAGE_COPY = {
  /**
   * The period the server measured, named by its own day count.
   *
   * `Last 30 days`, never `This month`: the analytics endpoint returns ROLLING
   * windows, and calling thirty rolling days a calendar month is a money claim that
   * is wrong for the first and last week of every month. Read from `window.days` so
   * the label cannot drift from the window it describes.
   */
  summaryLabel: (days: number): string => `Last ${days} days`,

  /** The two actions are a set of destinations, so the group is named once. */
  actionsLabel: 'Actions',

  /** The row leads to the figures behind it, on Activity's analytics view. */
  summaryHref: '/app/activity?view=analytics',

  /** Who the money went to. */
  merchantsTitle: 'Paid recently',
  /** Leaves for the full ledger, which is where each of these rows points. */
  activityHref: '/app/activity',
  /** A word, not a sentence: it sits beside the heading. */
  seeAll: 'See all',
  /** What makes a total legible: one payment and nine are different facts. */
  paymentCount: (count: number): string => (count === 1 ? '1 payment' : `${count} payments`),
  /** The invite that brought this visitor names nobody (see `HomeSignedOutGate`). */
  inviteNotLive: 'That invite link is not live.',
} as const;
