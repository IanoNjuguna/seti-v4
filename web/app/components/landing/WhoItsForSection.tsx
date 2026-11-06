import { Band } from './Band';
import { SectionHeader } from './SectionHeader';
import { WHO_ITS_FOR_COPY } from './WhoItsForSection.constants';

/**
 * Who it is for: the band that answers the question a visitor arrives with.
 *
 * WHY HERE, DIRECTLY UNDER `how`: a reader who has just taken in the mechanic is asking
 * whether it is for them, and the page used to answer that question nowhere at all. The
 * page's own docblock records the order and the reason.
 *
 * THREE IN A ROW, NOT A SEQUENCE OF THREE. The band is a set of audiences, so it is a
 * three-column grid at `lg` (2-up at `sm`, 1-up on a phone: the system's own feature
 * grid, `design/revolut.md`), each column capped by its own top hairline. A hairline over
 * a column says "one of three" rather than "step one", which is what a numbered row would
 * have said, and the numbered rows are `how`'s, one band above, so a second set of them
 * would read as a second procedure.
 *
 * NO CARD, NO PLATE, NO SHADOW. The three sit directly on the band, because the system
 * has no drop shadows on white and a plate around each would make them three claims of
 * equal weight against a product page that is deliberately one column of prose. The
 * hairline is the only line in the band.
 *
 * LIGHT CANVAS, with a top hairline because the band above it is light too: the rule
 * separates two white bands rather than shading one, which is the same discipline
 * `HowSection` uses at its own top edge.
 *
 * THE HEADING IS THE COPY'S OWN ("Three kinds of seller.") and the marker above it is the
 * band's name, so `SectionHeader` renders the marker as a paragraph and the heading as
 * the `h2`. The three titles are `h3`s under it.
 */
export function WhoItsForSection() {
  return (
    <Band
      id="who"
      className="border-t border-hairline-light bg-canvas-light py-[var(--band-pad-block)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow={WHO_ITS_FOR_COPY.eyebrow} title={WHO_ITS_FOR_COPY.heading} />

        <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {WHO_ITS_FOR_COPY.items.map((item) => (
            <li key={item.title} className="border-t border-hairline-light pt-6">
              <h3 className="font-brand text-heading-sm font-medium text-ink">{item.title}</h3>
              <p className="mt-2 text-body-md text-mute">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Band>
  );
}
