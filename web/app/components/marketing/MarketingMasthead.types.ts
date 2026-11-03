import type { ReactNode } from 'react';

/** The dictated pair at the top of a marketing route: its h1, and one sentence under it. */
export interface MarketingMastheadCopy {
  title: string;
  lede: string;
}

export interface MarketingMastheadProps extends MarketingMastheadCopy {
  /** The page's first list, which belongs to the h1 rather than to a band of its own. */
  children: ReactNode;
}
