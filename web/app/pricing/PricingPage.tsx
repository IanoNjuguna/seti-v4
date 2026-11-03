import {
  MarketingBand,
  MarketingClose,
  MarketingMasthead,
  MarketingPriceList,
  MarketingRowList,
  MarketingShell,
  MarketingBreadcrumb,
  MarketingStatementList,
} from '../components/marketing';
import {
  COMPARISON_EYEBROW,
  COMPARISON_ROWS,
  PRICE_LINES,
  PRICING_MASTHEAD,
  REFUSALS,
  REFUSALS_EYEBROW,
  SIBLING_LINK,
} from './PricingPage.constants';

/**
 * `/pricing`: the price, what it is measured against, and what it is not.
 *
 * THE ORDER IS THE READER'S ARGUMENT. The h1 and its lede state the price and do the sum; the
 * three lines under them answer the question the word "fee" raises — is there a monthly one,
 * is there a floor — before the reader has to ask it. Then the comparison, because a Kenyan
 * reader's next move is to hold the number against a till. Then the refusals, which only make
 * sense once the comparison has printed a figure we lose to.
 *
 * THE PRICE LIST IS IN THE MASTHEAD rather than in a band of its own: the dictated copy gives
 * it no heading, and it is the sentence above it, itemised. See `MarketingMasthead`.
 *
 * THREE LISTS, THREE SHAPES, and each is decided by what the rows ARE. The price is a `dl`
 * because a figure and its meaning are a term and a definition; the comparison is an h3 list
 * because each row is a named thing with a sentence about it; the refusals are plain
 * sentences because no title would be shorter than the sentence itself.
 *
 * The band ids are absent on purpose: nothing links into these pages by anchor, and an id is
 * a promise that a hash will land somewhere.
 */
export function PricingPage() {
  return (
    <MarketingShell>
      {/* The trail this page publishes, so a crawler knows it is one level under `/`. */}
      <MarketingBreadcrumb path="/pricing" label="What it costs" />
      <MarketingMasthead title={PRICING_MASTHEAD.title} lede={PRICING_MASTHEAD.lede}>
        <MarketingPriceList rows={PRICE_LINES} onDark />
      </MarketingMasthead>

      <MarketingBand eyebrow={COMPARISON_EYEBROW}>
        <MarketingRowList rows={COMPARISON_ROWS} />
      </MarketingBand>

      <MarketingBand eyebrow={REFUSALS_EYEBROW}>
        <MarketingStatementList statements={REFUSALS} />
      </MarketingBand>

      <MarketingClose link={SIBLING_LINK} />
    </MarketingShell>
  );
}
