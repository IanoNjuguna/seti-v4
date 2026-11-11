import { Band } from './Band';
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
 * DARK CANVAS SINCE #552, with a top hairline. `who` above it is dark too, so the flip no
 * longer separates them and the rule does the work; a dark band under a dark band with
 * nothing between them is one band with a gap in it. The earlier note here argued the run
 * from `how` to this band had to stay light so `MoneySection` could keep calling itself "the
 * first dark band after the hero". The owner took that call the other way: the stretch from
 * `who` to the price is one movement about money, it is dark end to end, and every record
 * that said otherwise moved with it.
 *
 * NOTHING HERE ASKS THE READER TO DO ANYTHING. There is no action in the band: it answers
 * "what do I ask my customer for", and the page's actions stay in the hero and the close,
 * where a decision is actually being made.
 *
 * THE OPENING MOVED INTO THE MARGIN (#540). The band used to open with the shared header:
 * a 12px caps marker over a 40px heading, the eighth band on the page to do so. The
 * sentence is now a `heading-md` note in the left column, level with the first row, and the
 * rows have the right eight columns. Nothing about the rows changed; what changed is that
 * the band no longer announces itself before saying anything, which is the band's whole
 * job (it is the payer's side of the same payment, not a new subject).
 */
export function YourCustomerSection() {
  return (
    <Band
      id="customer"
      className="border-t border-hairline-dark bg-canvas-dark pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          {/* THE SENTENCE IS A MARGIN NOTE, NOT A BAND HEADER (#540). It used to be the
              shared header: a 12px caps marker over a 40px heading, the same opening as
              most of the page. Here it sits in the left column at `heading-md`, level with
              the first row, so the band opens straight into the list it is about and the
              sentence reads as the note beside it. One h2 either way: it is the `h2` now
              rather than `SectionHeader`'s promotion. */}
          <div className="lg:col-span-4">
            <h2 className="max-w-xs font-brand text-heading-md font-medium text-on-dark">
              {YOUR_CUSTOMER_COPY.heading}
            </h2>
          </div>

          <div className="lg:col-span-8">
            {YOUR_CUSTOMER_COPY.items.map((item) => (
              <div
                key={item.title}
                className="border-t border-hairline-dark py-6 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-baseline sm:gap-10"
              >
                <h3 className="font-brand text-heading-sm font-medium text-on-dark">{item.title}</h3>
                <p className="mt-2 text-body-md text-on-dark-mute sm:mt-0">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Band>
  );
}
