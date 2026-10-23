import { Reveal } from './Reveal';
import { SectionEyebrow } from './SectionEyebrow';
import { REFUSAL_ROWS, REFUSALS_EYEBROW, REFUSALS_HEADING } from './RefusalsSection.constants';

/**
 * What Seti refuses to do — the light band before the close.
 *
 * ## Where it sits, and why there
 *
 * Between Integrations and the closing band. The integrations band above it marks
 * the two fiat rails "Not in use yet"; this band says, in words, what that means
 * for the reader (no cards, no bank transfers). And it is the last thing said
 * before the button: a reader deciding whether to open the app is deciding whether
 * to trust the rail, and the three answers are an absence, which a screenshot of
 * the product working cannot show.
 *
 * PLACEMENT IS ALSO WHAT KEEPS THE BAND ALTERNATION. The page runs dark, light,
 * dark, light, dark, and it ended with two darks (Integrations then the close). A
 * light band between them restores the stripe, so this band costs the page no new
 * pattern. It is the same reason it carries no `border-t`: a light band following
 * a dark one has its own edge, which is why Fees has none either.
 *
 * ## One band, one list, no cards
 *
 * Five/seven: the eyebrow and the heading get the narrow column, the three
 * refusals the wide one, hairline separated, label over detail. That is the
 * page's own repeating rhythm (Money and Fees are the other two lists) and it
 * means three statements do not arrive as three cards. A card around each
 * refusal would turn three promises into three products on a comparison page.
 *
 * It is STACKED label/detail rather than Fees' label-left/detail-right, because
 * these details are sentences and the price list's are figures. Two sentences
 * right-aligned in a narrow column is a shape nobody reads.
 *
 * ## The wording is data, and the data is checked
 *
 * Every string is in `RefusalsSection.constants.ts`, and
 * `npm run check:refusals --workspace web` renders this component, reads the HTML
 * for the three sentences, and tests each claim against the backend source. This
 * file holds no copy, so there is one place a sentence can be changed and one
 * place it can be disproved.
 */
export function RefusalsSection() {
  return (
    <Reveal id="refusals" className="bg-canvas-light py-[var(--band-pad-block)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <SectionEyebrow label={REFUSALS_EYEBROW} />
            <h2 className="mt-6 max-w-md font-brand text-heading-lg font-medium text-ink sm:text-display-md">
              {REFUSALS_HEADING}
            </h2>
          </div>

          <dl className="md:col-span-7">
            {REFUSAL_ROWS.map((row) => (
              <div
                key={row.id}
                className="border-t border-hairline-light py-6 first:border-t-0 first:pt-0"
              >
                <dt className="font-brand text-heading-md font-medium text-ink">{row.label}</dt>
                <dd className="mt-2 max-w-lg text-body-md text-mute">{row.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Reveal>
  );
}
