/**
 * The home page's own words.
 *
 * The PAGE carries every word on Home (the rule the surface was rebuilt for):
 * the greeting (`greeting.constants.ts`), the quick actions
 * (`quick-actions.constants.ts`), and the recent-activity section's framing
 * here. The balance is the one surface, and it keeps its own labels.
 *
 * The section's heading lives here rather than in `HomeActivity` because it is
 * page text, not part of the list: the list carries objects, the page names
 * them — the same split `/app/receive` makes between `RECEIVE_PAGE_COPY` and
 * its halves.
 */
export const HOME_PAGE_COPY = {
  /** The section's heading. Names what the rows are, in the page's own voice. */
  activityTitle: 'Recent activity',
  /** Leaves for the full history. A word, not a sentence — it sits beside the heading. */
  activitySeeAll: 'See all',
} as const;
