/** A real link from one marketing route to its sibling. */
export interface MarketingCloseLink {
  label: string;
  href: string;
}

export interface MarketingCloseProps {
  /** The sibling route, offered under the action rather than beside it. */
  link: MarketingCloseLink;
}
