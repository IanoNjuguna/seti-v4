import { ButtonLink } from '@/components/ui/ButtonLink';
import { Band } from './Band';
import { PaymentStack } from './PaymentStack';
import { HOW_COPY } from './HowSection.constants';

/**
 * How money reaches you — the first light band, and the band that carries the
 * MECHANIC.
 *
 * THE HEADER IS THE BAND'S OWN `h2` NOW (#540), not `SectionHeader`'s marker (#292): the
 * marker alone was the page's second identical opening. The
 * band's display heading ("How people pay you.") went in #288 for restating the marker,
 * and the sentence under it went too: "Seti is a payment app for shops and traders.
 * Customers pay by your name, or by the code on your counter." described the reader's own
 * situation and then re-told step one, which is the first row underneath it. The band now
 * opens with HOW IT WORKS and lands straight on "They choose how to pay you." — the
 * mechanic, with nothing said twice on the way in.
 *
 * Seven/five, and the columns are ROWS with hairlines rather than a row of cards:
 * hairline rows say "a sequence" and cost a fraction of the furniture. The feed is a
 * payment feed, not a decorative card, because the band is about what the steps produce.
 *
 * THE OBJECT COMES FIRST, AND IT IS THE BAND'S OPENING (#540). The feed used to sit on
 * the right, opposite a 12px caps eyebrow that named the band, which made this the second
 * of nine bands opening with the same marker at the same x. The stack now leads in the DOM
 * and in the grid, and the words sit beside it: the band opens on the thing the mechanic
 * produces rather than on a label saying there is a mechanic. The earlier note here said
 * `md:order-1/2` swapped the two so the steps kept the left (reading) column; that swap is
 * gone with the eyebrow. "How it works" is now the band's `h2` at display scale, the same
 * string the eyebrow was already being promoted to for the outline, so there is still
 * exactly one h2 in this band.
 *
 * NO FILLED CONTROL (#540). The lime commit that used to close this band made four of them
 * on one page, and a band that ends on a button reads as a slide with a "next" arrow. The
 * way out to the whole mechanic is the ghost link under the rows, which answers a
 * different question than the sign-up does.
 */
export function HowSection() {
  return (
    <Band
      id="how"
      className="bg-canvas-light pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
          {/* The feed is a third the height of the rows beside it, so the column is centred
              against them rather than stretched: top-aligned, the band ended with a third of
              an empty column under the last card, which reads as a missing object rather than
              as air. Centred, the slack splits above and below the feed. */}
          <div className="md:col-span-5 md:self-center">
            <PaymentStack />
          </div>

          <div className="md:col-span-7">
            <h2 className="max-w-md font-brand text-heading-lg font-medium text-ink sm:text-display-md">
              How it works
            </h2>

            <ol className="mt-10">
              {HOW_COPY.steps.map((step) => (
                <li
                  key={step.index}
                  className="flex gap-6 border-t border-hairline-light py-7 first:border-t-0 first:pt-0"
                >
                  <span className="font-tabular text-body-sm font-semibold text-mute">
                    {step.index}
                  </span>
                  <div>
                    <h3 className="font-brand text-heading-sm font-medium text-ink">{step.title}</h3>
                    <p className="mt-2 max-w-sm text-body-md text-mute">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* THE WAY OUT TO THE WHOLE MECHANIC, AND NOT A SECOND CTA (#540). This row
                used to pair the lime commit with the ghost link, which put the page's
                loudest object in four bands and made each of them end on a "next" button.
                The commit belongs to the hero and the close. What is left answers the
                question the three rows above raise and do not settle: the same payment, on
                its own page, step by step. */}
            <div className="mt-8">
              <ButtonLink href="/how-it-works" variant="ghost">
                The whole payment, step by step
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </Band>
  );
}
