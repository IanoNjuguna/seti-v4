import { Reveal } from './Reveal';
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
 * label ("2% of each payment") renders 236px, so it has hundreds of pixels of
 * slack. The column grew to 22rem while the first row was carrying the payer's
 * wording (the longer of the two); that wording is gone with the personal reading,
 * and the column is left at the width the pair was measured at rather than quietly
 * narrowed. Re-measure this pair if the fee copy moves again.
 *
 * IT USED TO CARRY A LINK. "Where the 2% goes" pointed at the footer's treasury
 * block, which published the address the fee is collected to, the one claim on this
 * page a reader could go and verify on chain. Both the link and the block are gone
 * (the owner's call), so the price list stands on its own and the number is
 * unverified from here. That is recorded rather than quietly accepted.
 */
export function FeesSection() {
  return (
    <Reveal id="fees" className="bg-canvas-light py-[var(--band-pad-block)]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow="What it costs" />

        <dl className="mt-12">
          {FEE_COPY.map((row) => (
            <div
              key={row.label}
              className="border-t border-hairline-light py-6 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[minmax(0,1fr)_22rem] sm:items-baseline sm:gap-10"
            >
              <dt className="font-brand text-heading-md font-medium text-ink">{row.label}</dt>
              <dd className="mt-2 text-body-sm text-mute sm:mt-0 sm:text-right">{row.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Reveal>
  );
}
