/**
 * The search field's vocabulary: where the query lives, and every word it says.
 *
 * The parameter is `q` beside `?view=`, so a result is a link: sending someone
 * "the payments to Akinyi last month" is sending them a URL, and reloading it
 * keeps the query the person typed.
 */
export const ACTIVITY_SEARCH_PARAM = 'q';

/** The field's id. The visible placeholder answers "what", the label answers "where". */
export const ACTIVITY_SEARCH_ID = 'activity-search';

/**
 * How long typing has to pause before the URL is rewritten.
 *
 * The list filters on every character (it is a local array, so there is nothing to
 * wait for); the URL is the slower, shareable copy of that state, and rewriting
 * history once per keystroke would spend a navigation per letter. A quarter of a
 * second is below the point a person notices and above the gap between keystrokes.
 */
export const ACTIVITY_SEARCH_WRITE_MS = 250;

export const ACTIVITY_SEARCH_COPY = {
  /** The field's accessible name. The placeholder is not one: it vanishes when filled. */
  label: 'Search your activity',
  placeholder: 'Search by name or amount',
  /** The clear control, both the button beside the no-match message and the field's X. */
  clear: 'Clear search',
  clearField: 'Clear the search',
  /** No match, and the field has seen every page the customer has loaded. */
  noMatchesBody: 'Try another name or amount, or clear the search to see everything.',
  /**
   * No match, and there are older pages still unloaded: the search has not seen the
   * whole history, and saying "nothing matches" would be a claim it cannot make.
   */
  noMatchesMore: 'Search looks at the payments already on this screen. Load more to look further back.',
  /** Names the query back, so the message is about what the person typed. */
  noMatches: (query: string) => `No payments match "${query}"`,
  /** Announced politely while a query is active, so a filtered list is not silent. */
  match: (count: number) => (count === 1 ? '1 payment matches' : `${count} payments match`),
} as const;
