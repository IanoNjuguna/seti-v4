import { FooterFacts } from './FooterFacts';
import { FooterIndex } from './FooterIndex';
import { FooterLegal } from './FooterLegal';
import { FooterRail } from './FooterRail';
import { FooterStatement } from './FooterStatement';
import { FooterWordmark } from './FooterWordmark';
import {
  FOOTER_FACTS,
  FOOTER_INDEX,
  FOOTER_LINKS,
  FOOTER_STATEMENT,
} from './LandingFooter.constants';

/**
 * The footer, in three movements.
 *
 * ONE: the statement, and the ledger beside it. The sentence is display type and the
 * ledger is three answers to money questions, aligned right so both halves stop on the
 * container's edge. This is the band's whole reason to exist — the page's last true
 * claim, at the point where a reader goes to check one.
 *
 * TWO: the index (left, seven columns) and the legal links (right, three). The leaders
 * run the width of the index column and stop where the legal column begins, so the gap
 * between them is a gutter rather than a hole; the eye reads `01…04` as one column and
 * `Privacy` as a separate set. Filling that gutter is how a footer becomes a four-column
 * link farm, which `landing-page-design` lists as a generic pattern.
 *
 * THREE: the rail. Lockup, colophon, done.
 *
 * WHAT REPLACED WHAT. It used to be one row: mark and copyright left, "Made in Thika"
 * centred, three legal links right, in a three-column grid whose centre cell was placed
 * by the grid rather than by `justify-between` (#274). That was correct and quiet and it
 * was one line of text at the bottom of a black page. The rebuild keeps every string,
 * every target size and every route, and gives the band three movements and the page's
 * strongest sentence, which is art the page can back rather than decoration it cannot.
 *
 * THE TREASURY BLOCK STAYS GONE. The address the 2% is collected to was deleted once and
 * is not restored here: this footer states the fee, it does not re-open a decision to
 * publish where the money lands.
 *
 * IT STAYS ON THE BLACK CANVAS rather than switching to white, flushed to `canvas-dark`
 * so it joins the closing band as flat black instead of showing the field's drift
 * through it: that lift belongs to the hero alone.
 */
export function LandingFooter() {
  return (
    <footer className="relative z-10 bg-canvas-dark">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 pb-14 pt-[var(--band-pad-block)] md:grid-cols-12 md:gap-16 md:pb-0">
          <div className="md:col-span-8 md:pb-16">
            <FooterStatement lines={FOOTER_STATEMENT} />
          </div>
          {/* The vertical hairline is what makes the empty middle structural: the top
              movement is two halves divided the way the movements below are divided, and
              the ledger reads as a column with an edge instead of as text floating right.
              IT RUNS TO THE SEPARATOR because the movement's own bottom padding lives on
              the columns rather than on the row: a border drawn on a grid item stops where
              that item's content stops, and a rule that ends 56px above the next hairline
              reads as a mistake rather than as a division. */}
          <div className="md:col-span-4 md:border-l md:border-hairline-dark md:pb-16 md:pl-8">
            <FooterFacts facts={FOOTER_FACTS} />
          </div>
        </div>

        <div className="grid gap-12 border-t border-hairline-dark py-12 md:grid-cols-12">
          <div className="md:col-span-7">
            <FooterIndex rows={FOOTER_INDEX} />
          </div>
          <div className="md:col-span-3 md:col-start-10">
            <FooterLegal links={FOOTER_LINKS} />
          </div>
        </div>

        <FooterRail />
      </div>
      {/* Full-bleed on purpose: the band is the page's edge, so it sits outside the content
          column's padding and is clipped by the footer's own bottom. */}
      <FooterWordmark />
    </footer>
  );
}
