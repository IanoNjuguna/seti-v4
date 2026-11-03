/**
 * The row shapes the two marketing routes share.
 *
 * Four shapes cover both pages: a titled row, a price line, a numbered step, and a sentence
 * with no title. Each is the landing's own vocabulary rather than a new one — `MarketingPriceLine`
 * is `LandingRow`'s label/detail pair, which is what `FeesSection` renders — so a row added to
 * a new route looks like a row on the route it came from.
 */

/** A titled row: the item's name, and one sentence under it. */
export interface MarketingRow {
  title: string;
  detail: string;
}

/** A price line: the figure, and what it means for the reader. */
export interface MarketingPriceLine {
  label: string;
  detail: string;
}

/** One step of a numbered sequence. */
export interface MarketingStep {
  /** Rendered tabular, so the steps line up as a column of figures. */
  index: string;
  title: string;
  detail: string;
}

/** A sentence on its own, for a list that has no titles to give. */
export interface MarketingStatement {
  text: string;
}
