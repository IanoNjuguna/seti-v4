import { Reveal } from './Reveal';
import { SectionEyebrow } from './SectionEyebrow';
import { PaymentStack } from './PaymentStack';
import { HOW_STEPS } from './HowSection.constants';

/**
 * How you get paid — the first light band, and the band that carries the
 * MECHANIC. The hero carries identity; this is where the page shows what the
 * steps actually produce, so the object here is a payment feed rather than a
 * decorative card.
 *
 * Seven/five, and the left column is a column of ROWS with hairlines rather
 * than a row of cards. The page used to answer this with a three-up card grid
 * in a five-up card grid in a four-up card grid; hairline rows say "a sequence"
 * and cost a fraction of the furniture.
 *
 * THE OBJECT COMES FIRST ON A PHONE — in the DOM, and therefore for a screen
 * reader too. `md:order-1/2` swaps the two for the grid, so on a wide screen the
 * steps keep the left (reading) column and the stack sits opposite them; at
 * 360px the reader meets the thing the band is about before three rows of prose,
 * which is the order the band argues in anyway.
 */
export function HowSection() {
  return (
    <Reveal
      id="how"
      className="border-t border-hairline-light bg-canvas-light py-[var(--band-pad-block)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionEyebrow label="How it works" />

        <div className="mt-12 grid grid-cols-1 gap-12 md:mt-16 md:grid-cols-12 md:gap-16">
          <div className="md:order-2 md:col-span-5">
            <PaymentStack />
          </div>

          <ol className="md:order-1 md:col-span-7">
            {HOW_STEPS.map((step) => (
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
        </div>
      </div>
    </Reveal>
  );
}
