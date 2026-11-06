import { Reveal } from './Reveal';
import { SectionHeader } from './SectionHeader';
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
 * ONE STRING, NOT TWO: the copy gives this band a heading ("Questions") and no marker, so
 * the marker IS the heading, promoted to the `h2` exactly as the three bands whose display
 * heading was deleted do it (`SectionHeader`). The render is a marker line; the outline
 * gets an `h2`.
 *
 * LIGHT CANVAS, AND IT CLOSES THE LIGHT RUN. `PartnersSection` below it is dark, so the
 * page's canvas step does the separating and this band carries no bottom rule; the top
 * hairline separates it from the fee rows above, which are light as well.
 *
 * WHERE IT SITS: after the price list and before the integrations row. A reader who has
 * just seen what it costs is asking the six things this band answers, and the band is the
 * last place on the page with room to answer in a sentence instead of a slogan.
 */
export function FaqSection() {
  return (
    <Reveal
      id="questions"
      className="border-t border-hairline-dark bg-canvas-dark py-[var(--band-pad-block)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow={FAQ_COPY.heading} onDark />

        <div className="mt-12">
          {FAQ_COPY.items.map((entry, index) => (
            <FaqItem key={entry.question} entry={entry} open={index === 0} />
          ))}
        </div>
      </div>
    </Reveal>
  );
}
