import type { ReactNode } from 'react';

/**
 * The dictated pair at the top of a marketing route: its h1, and the one sentence under
 * it — where the page has one.
 *
 * `lede` IS OPTIONAL. It was required, and `/convert` is the case that showed why: its h1
 * says what the page is for and the calculator under it is the answer, so a sentence in
 * between would restate the headline rather than add to it. An empty string on a required
 * field would have been the same page with a lie in its type.
 */
export interface MarketingMastheadCopy {
  title: string;
  lede?: string;
}

export interface MarketingMastheadProps extends MarketingMastheadCopy {
  /** The page's first list, which belongs to the h1 rather than to a band of its own. */
  children: ReactNode;
}
