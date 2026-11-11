import Link from 'next/link';
import { QUIET_ACTION_CLASSES } from './HeroActions.constants';
import { Band } from './Band';
import { SectionHeader } from './SectionHeader';
import { FEE_COPY } from './FeesSection.constants';

/**
 * Fees — the second light band, and the price list.
 *
 * THE BAND OPENS WITH ITS MARKER AND NOTHING ELSE (#288). "No hidden charges" was the
 * heading; the owner deleted it with the other two bands', because the price list under
 * it says the same thing four times over and the marker ("What it costs") already names
 * the band. The marker carries the h2 now, so the band keeps a heading.
 *
 * Before that deletion the heading sat above the list, and before THAT it shared a
 * twelve-column grid with the rows, split four/eight below `lg` and five/seven above —
 * a split chosen against a measured width, because at five columns "No hidden charges"
 * sat on one line and the list still left its widest label one line. With no heading
 * there is no column and no split to decide, so the rows run the band's full content
 * width (1104px at `max-w-6xl`).
 *
 * THE ROWS KEEP A FIXED DETAIL COLUMN, and it is load-bearing rather than taste:
 * `minmax(0,1fr) 22rem` with a 40px gap. The detail column is fixed because its
 * strings are the long ones and a column that gave width away would wrap them into
 * the label's baseline; the label column takes whatever is left, and its widest
 * label ("One flat fee a payment", which replaced "2% of each payment" in #348 and is
 * wider than the 236px that one measured) has not been re-measured since. The column
 * grew to 22rem while the first row was carrying the payer's wording (the longer of
 * the two); that wording is gone with the personal reading, and the column is left at
 * the width the pair was measured at rather than quietly narrowed. Re-measure this
 * pair when the fee copy moves again: it moved in #348.
 *
 * IT USED TO CARRY A LINK. "Where the 2% goes" pointed at the footer's treasury
 * block, which published the address the fee is collected to, the one claim on this
 * page a reader could go and verify on chain. Both the link and the block are gone
 * (the owner's call), so the price list stands on its own and the number is
 * unverified from here. That is recorded rather than quietly accepted.
 *
 * THE COLUMN STAYS 22rem IN THE PANEL (#540). It was tried at 20rem to give the label
 * column 32px back, and 20rem is where the widest detail gives up: "A small payment is
 * charged the same flat fee." measures 322px at `body-sm` in the rendered panel, so a 320px
 * column took it to two lines and the second line was one word, right-aligned under the
 * first. Measured in the browser rather than estimated, and the panel's own padding comes
 * out of the label column instead. Re-measure this pair when the fee copy moves again: it
 * moved in #348.
 */
export function FeesSection() {
  return (
    <Band id="fees" className="bg-canvas-dark pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]">
      <div className="mx-auto max-w-6xl px-6">
        {/* THE PRICE LIST IS AN OBJECT INSIDE THE DARK RUN (#540). It used to be a second
            black stripe under `Your money` with nothing between them but 189px of black, so
            the two bands read as one long band with a gap in it — neither joined nor
            separated. An inset panel (`surface-elevated`, the system's dark elevation step,
            hairline edge, no shadow) gives the list an edge and a top and bottom of its own,
            which is the separation the seam was missing, and it puts the price in the one
            thing on the page a reader can point at.

            THE PANEL IS ALSO WHAT LETS THE TWO DECISION POINTS SHARE A BAND: `Your money`
            and the price are one movement (what it is, then what it costs) and stay on one
            canvas, as #359 argued, while the price now has a shape of its own. */}
        <div className="rounded-md border border-hairline-dark bg-surface-elevated p-6 sm:p-8 lg:p-10">
          <SectionHeader
            eyebrow="What it costs"
            onDark
            /* THE WAY OUT TO `/pricing` IS A QUIET LINK, not a ghost button: the ghost
               variant draws its label in cobalt, which measures 4.27:1 on black and fails
               AA at this size, so this band uses the hero's dark-canvas recipe instead.
               It sits on the header's trailing edge now (#540) rather than under the
               rows, where it used to share a row with the lime commit: the band ends on
               the price, and one thing to read sits beside the label that names it. */
            trailing={
              <Link href="/pricing" className={QUIET_ACTION_CLASSES}>
                What that costs against a till
              </Link>
            }
          />

          <dl className="mt-10">
            {FEE_COPY.map((row) => (
              <div
                key={row.label}
                className="border-t border-hairline-dark py-5 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[minmax(0,1fr)_22rem] sm:items-baseline sm:gap-10"
              >
                <dt className="font-brand text-heading-md font-medium text-on-dark">{row.label}</dt>
                <dd className="mt-1 text-body-sm text-on-dark-mute sm:mt-0 sm:text-right">
                  {row.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Band>
  );
}
