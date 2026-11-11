import { Band } from './Band';
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
 * THE HEADING IS THE COPY'S OWN ("Three kinds of seller.") and it is the band's opening
 * (#540). It used to sit under a 12px caps marker, which made this band open the same way
 * as seven others; now the sentence IS the opening, set at `display-lg` and `display-xl`
 * (48/80px) against the 40px every other band's heading uses. That is the page's one scale
 * jump below the hero: the reader meets a section that says one thing loudly, and the three
 * audiences under it are the detail rather than the subject. The marker ("Who it is for")
 * is no longer rendered and stays in the constants because the copy is the owner's; the
 * sentence already says it, which is the argument #288 made for the bands that lost their
 * display headings.
 *
 * The three titles remain `h3`s under it, so the outline is unchanged: one h2, three items.
 */
export function WhoItsForSection() {
  return (
    <Band
      id="who"
      className="border-t border-hairline-light bg-canvas-light pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="max-w-3xl font-brand text-display-lg font-medium text-ink lg:text-display-xl">
          {WHO_ITS_FOR_COPY.heading}
        </h2>

        <ul className="mt-14 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
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
