import {
  MarketingBand,
  MarketingClose,
  MarketingMasthead,
  MarketingRowList,
  MarketingShell,
  MarketingBreadcrumb,
  MarketingStepList,
} from '../components/marketing';
import {
  FAILURES_EYEBROW,
  FAILURE_ROWS,
  HOW_IT_WORKS_MASTHEAD,
  LANDS_EYEBROW,
  LANDS_ROWS,
  SIBLING_LINK,
  STEPS,
} from './HowItWorksPage.constants';

/**
 * `/how-it-works`: the three moves a customer makes, then what the money does.
 *
 * THE STEPS ARE IN THE MASTHEAD, because the dictated copy gives them no heading of their
 * own and they are the sentence above them, itemised. Everything below has a dictated h2 and
 * therefore a band of its own.
 *
 * THE TWO BANDS ARE THE TWO QUESTIONS LEFT AFTER THE STEPS: where the dollars actually land
 * (a merchant's real doubt, having been paid by an app before), and what happens when it goes
 * wrong. Both answer with what happens to the money, never with how the product is built —
 * the voice's rule, and the reason no sentence here names anything a reader would have to
 * look up.
 *
 * THREE SHAPES AGAIN. The steps are an ordered list with numerals because they happen in
 * sequence; the two bands are h3 lists because each row is a named thing with a sentence
 * under it. `MarketingBand` promotes each dictated h2 from the marker, so the outline is one
 * h1, two h2s, six h3s and the close's h2 — nothing empty, nothing used as layout. The six
 * are the band rows only: the steps sit under the h1 with no h2 above them, so their titles
 * are set in the heading face without a heading element (see `MarketingStepList`).
 */
export function HowItWorksPage() {
  return (
    <MarketingShell>
      {/* The trail this page publishes, so a crawler knows it is one level under `/`. */}
      <MarketingBreadcrumb path="/how-it-works" label="How it works" />
      <MarketingMasthead title={HOW_IT_WORKS_MASTHEAD.title} lede={HOW_IT_WORKS_MASTHEAD.lede}>
        <MarketingStepList steps={STEPS} onDark />
      </MarketingMasthead>

      <MarketingBand eyebrow={LANDS_EYEBROW}>
        <MarketingRowList rows={LANDS_ROWS} />
      </MarketingBand>

      <MarketingBand eyebrow={FAILURES_EYEBROW}>
        <MarketingRowList rows={FAILURE_ROWS} />
      </MarketingBand>

      <MarketingClose link={SIBLING_LINK} />
    </MarketingShell>
  );
}
