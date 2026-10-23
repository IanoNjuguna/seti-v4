import { Reveal } from './Reveal';
import { SectionHeader } from './SectionHeader';
import { PaymentStack } from './PaymentStack';
import { HOW_COPY } from './HowSection.constants';
import type { AudienceProps } from './Audience.types';

/**
 * How money reaches you — the first light band, and the band that carries the
 * MECHANIC.
 *
 * THE HEADING IS THE SHARED ONE (`SectionHeader`), which is the change to this
 * band's shape: every band on the page now opens with the eyebrow, the heading and
 * one sentence in the same place, which is the rhythm cash.app's bands keep and
 * what this page was missing when each section carried its own idea of a heading.
 * The sentence under the heading is the READER'S, so the selector has something
 * substantial to change here rather than only in the hero.
 *
 * Seven/five, and the left column is a column of ROWS with hairlines rather than a
 * row of cards: hairline rows say "a sequence" and cost a fraction of the
 * furniture. The object on the right is a payment feed, not a decorative card,
 * because the band is about what the steps produce.
 *
 * THE OBJECT COMES FIRST ON A PHONE, in the DOM and therefore for a screen reader
 * too; `md:order-1/2` swaps the two for the grid, so on a wide screen the steps
 * keep the left (reading) column and the stack sits opposite them.
 */
export function HowSection({ audience }: AudienceProps) {
  const copy = HOW_COPY[audience];

  return (
    <Reveal
      id="how"
      className="border-t border-hairline-light bg-canvas-light py-[var(--band-pad-block)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow="How it works" title={copy.title} lede={copy.lede} />

        <div className="mt-12 grid grid-cols-1 gap-12 md:mt-16 md:grid-cols-12 md:gap-16">
          <div className="md:order-2 md:col-span-5">
            <PaymentStack />
          </div>

          <ol className="md:order-1 md:col-span-7">
            {copy.steps.map((step) => (
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
