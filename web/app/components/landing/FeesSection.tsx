import { Reveal } from './Reveal';
import { SectionEyebrow } from './SectionEyebrow';
import { FEE_ROWS } from './FeesSection.constants';

/**
 * Fees — the second light band, laid out heading-five / list-seven from `lg` up,
 * the same split `HowSection` uses: the price list gets the wide column so the
 * table lines up, and the heading gets the width it needs to sit on one line.
 * Below `lg` the band stays four/eight, exactly as it was.
 *
 * THE SPLIT IS NOT THE PAGE'S OTHERS, AND THIS IS WHY (all measured in the
 * browser). `max-w-6xl` caps the band at 1152px and `px-6` takes 24px a side, so
 * the content box is 1104px at 1280 AND at 1440 — a wider window buys this band
 * nothing — and of those 1104px the 12-column grid's `md:gap-16` gutters are
 * 11 × 64px = 704px. A column is therefore 33.33px, which makes the heading side:
 *
 *   span  measured  "No hidden charges" is font-brand 500 / 40px / -0.02em,
 *   4/12  325.33px  so it renders 382.2px in Poppins (348.25px when this band was
 *   5/12  422.66px  first measured in Space Grotesk, before the face changed) and
 *                   wrapped as "No hidden" / "charges" at four. Five fits with
 *   6/12  519.97px  40.5px of air. Six (519.97px) fits too, but starves the list
 *                   - see below. Re-measure this pair if the display face moves
 *                   again: the split was chosen against a width, not a glyph set.
 *
 * The rows are `minmax(0,1fr) 18rem` with a 40px gap, so whichever way the split
 * moves, the label column is what pays: 714.67 − 288 − 40 = 386.67px at 8/12,
 * 617.33 − 288 − 40 = 289.33px at 7/12. The widest label ("2% of each payment")
 * renders 236.14px, so seven still leaves 53px of slack and all three labels
 * hold one line. The detail column keeps its fixed 288px — its widest string
 * measures 287.61px, 0.39px of slack, so it is in no position to give width away
 * — and six for the heading would have taken the label column to 191.97px and
 * wrapped it.
 *
 * Below 1024px the band stays four/eight. Going 5/7 at `md` instead would hand
 * the label column 205.91px at 1024 and ~65px at 768, trading the heading's wrap
 * for wraps on labels that never had one. From `lg` up the heading sits on one
 * line with 14.8px of slack at 1024 and 74.4px at 1280/1440; between 1024 and
 * ~1060 the widest label wraps instead. That is the fallback, left to the grid
 * rather than forced away with `whitespace-nowrap`: a nowrap heading in a column
 * too narrow for it overflows into the rows, which is worse than the wrap it
 * removes. The type is never shrunk.
 *
 * IT USED TO CARRY A LINK. "Where the 2% goes" pointed at the footer's treasury
 * block, which published the address the fee is collected to — the one claim on
 * this page a reader could go and verify on chain. Both the link and the block
 * are gone (the owner's call), so the price list now stands on its own and the
 * number is unverified from here. The rows are unchanged.
 *
 * The heading is the owner's wording too — "No hidden charges" — which drops the
 * figure out of the band's prose and leaves it to the rows below.
 */
export function FeesSection() {
  return (
    <Reveal id="fees" className="bg-canvas-light py-[var(--band-pad-block)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-4 lg:col-span-5">
            <SectionEyebrow label="What it costs" />
            <h2 className="mt-6 font-brand text-heading-lg font-medium text-ink sm:text-display-md">
              No hidden charges
            </h2>
          </div>

          <dl className="md:col-span-8 lg:col-span-7">
            {FEE_ROWS.map((row) => (
              <div
                key={row.label}
                className="border-t border-hairline-light py-6 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-baseline sm:gap-10"
              >
                <dt className="font-brand text-heading-md font-medium text-ink">{row.label}</dt>
                <dd className="mt-2 text-body-sm text-mute sm:mt-0 sm:text-right">{row.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Reveal>
  );
}
