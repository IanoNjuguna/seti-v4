import { Band } from './Band';
import { FaqItem } from './FaqItem';
import { FAQ_COPY } from './FaqSection.constants';

/**
 * The six questions: the last light band, and the only band built to be quoted.
 *
 * WHY THE SEMANTICS ARE LOAD-BEARING. The band's heading is its `h2`, each question is an
 * `h3` inside its own row, each answer is a paragraph under its question, and nothing is
 * collapsed: no `button`, no `summary`, no `details`, no `aria-expanded`. The answers are
 * in the server HTML because a crawler and an assistant read the bytes and not the
 * interaction. A page whose FAQ is assembled by a click has no FAQ as far as either is
 * concerned, and a reader comparing six answers should not have to open six disclosures.
 * `FaqItem` owns the row and records the trade.
 *
 * THE SAME STRINGS ARE THE STRUCTURED DATA. `web/lib/faq-schema.ts` builds the page's
 * `FAQPage` node out of `FAQ_COPY`, the constant this band renders, and
 * `web/lib/structured-data.ts` appends it to the root layout's `@graph`. There is no
 * second copy of a question in the repo, so a copy edit cannot leave the markup and the
 * JSON-LD saying different things, which is the failure a hand-written schema block
 * always eventually produces.
 *
 * ONE STRING, NOT TWO: the copy gives this band one heading and no marker. Until #552 that
 * string was rendered as the marker line and promoted to the `h2`; it is a heading now, and
 * the string itself changed with it (see the constant).
 *
 * DARK CANVAS, and the canvas step does the separating on both sides: `start` above is white
 * and `partners` below carries its own top hairline, so this band needs no rules of its own.
 * (This comment used to say the band was light and closed the light run, which had been false
 * since the band was painted `canvas-dark`; corrected while the heading changed.)
 *
 * WHERE IT SITS: after the price list and before the integrations row. A reader who has
 * just seen what it costs is asking the six things this band answers, and the band is the
 * last place on the page with room to answer in a sentence instead of a slogan.
 */
export function FaqSection() {
  return (
    <Band
      id="questions"
      className="bg-canvas-dark pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        {/* THE HEADING SAYS WHO ASKS AND WHEN (#552). It was the word "Questions", which
            named the shape of the band rather than anything a reader wanted. The string is
            still `FAQ_COPY.heading` and still the band's only `h2`; it is set as a heading
            now instead of as the marker, so the page's bands no longer open with the same
            12px label. */}
        <h2 className="max-w-2xl font-brand text-heading-lg font-medium text-balance text-on-dark sm:text-display-md">
          {FAQ_COPY.heading}
        </h2>

        <div className="mt-12">
          {FAQ_COPY.items.map((entry, index) => (
            <FaqItem key={entry.question} entry={entry} open={index === 0} />
          ))}
        </div>
      </div>
    </Band>
  );
}
