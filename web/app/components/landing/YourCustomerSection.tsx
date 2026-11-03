import { Reveal } from './Reveal';
import { SectionHeader } from './SectionHeader';
import { YOUR_CUSTOMER_COPY } from './YourCustomerSection.constants';

/**
 * What your customer does: the same payment, from the payer's side.
 *
 * WHY THIS SHAPE. Hairline rows, with the term in a fixed left column and one sentence
 * taking the rest. That is the page's row grammar (`how` numbers its rows, the fee list
 * pairs a label with a detail), and it says "three separate things" without the cards,
 * plates or shadows this system does not use on white.
 *
 * EACH TERM IS AN `h3`, NOT A `dt`. A definition list was the first draft and it was
 * wrong for this page: the three terms ("A phone", "A Seti account", "Their own dollars")
 * are the only names these items have, and a `dt` leaves them anonymous in the heading
 * outline, so the band's `h2` would have had nothing under it while the bands either side
 * of it each carried three `h3`s. A crawler and a screen reader's heading list both read
 * the outline, and the terms are exactly what a merchant scans for.
 *
 * THE TERM COLUMN IS FIXED AT 18rem and the sentence takes the rest. Fixed, because the
 * three terms are labels and a column that gave width away would let the longest one wrap
 * into its own sentence's baseline; 18rem holds "Their own dollars" on one line at
 * `heading-sm` with room to spare. The sentence column is left-aligned because it is
 * prose, which is the one place this list differs from the fee rows below it (that column
 * is right-aligned `body-sm` and holds numbers).
 *
 * LIGHT CANVAS, with a top hairline, following the same discipline as the band above. The
 * three light bands in the middle of the page (`how`, `who`, `what your customer does`)
 * are one catalogue run between the hero and the first dark band, and the run is left
 * light on purpose: `MoneySection` records that its own band is "the first dark band after
 * the hero", and painting this one dark would have made that sentence false and put one
 * black band directly above another.
 *
 * NOTHING HERE ASKS THE READER TO DO ANYTHING. There is no action in the band: it answers
 * "what do I ask my customer for", and the page's actions stay in the hero and the close,
 * where a decision is actually being made.
 */
export function YourCustomerSection() {
  return (
    <Reveal
      id="customer"
      className="border-t border-hairline-light bg-canvas-light py-[var(--band-pad-block)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow={YOUR_CUSTOMER_COPY.eyebrow} title={YOUR_CUSTOMER_COPY.heading} />

        <div className="mt-12">
          {YOUR_CUSTOMER_COPY.items.map((item) => (
            <div
              key={item.title}
              className="border-t border-hairline-light py-6 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[18rem_minmax(0,1fr)] sm:items-baseline sm:gap-10"
            >
              <h3 className="font-brand text-heading-sm font-medium text-ink">{item.title}</h3>
              <p className="mt-2 text-body-md text-mute sm:mt-0">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
