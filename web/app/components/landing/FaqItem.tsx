import type { FaqItemProps } from './FaqItem.types';

/**
 * One question, and its answer printed under it.
 *
 * NO CONTROL, NO COLLAPSE, AND THAT IS THE POINT. The question is an `h3` and the answer
 * is a paragraph in the same row: there is no `button`, no `summary`, no `details`, no
 * `aria-expanded` and no closed state anywhere in this component. A crawler and an
 * assistant read the bytes the server sends, not the interaction, so an answer that only
 * exists after a tap is an answer neither of them can quote, and a person who wants to
 * compare six answers should not have to open six disclosures to do it. The usual
 * accordion argument (less scroll) is real and was weighed: with six answers of one or
 * two lines each it buys about a screenful and costs every answer's presence in the HTML.
 *
 * `text-wrap: pretty` is not used here and neither is any clamp: an answer that is
 * truncated to fit a row is an answer the page shipped and the reader did not get.
 *
 * The row's hairline spans the band and the paragraph is capped at `max-w-2xl`, which is
 * how the rule separates rows without the sentence running the width of a 1104px band,
 * the same treatment `HowSection` gives the body inside its own hairline rows.
 */
export function FaqItem({ entry }: FaqItemProps) {
  return (
    <div className="border-t border-hairline-light py-6 first:border-t-0 first:pt-0">
      <h3 className="font-brand text-heading-sm font-medium text-ink">{entry.question}</h3>
      <p className="mt-2 max-w-2xl text-body-md text-mute">{entry.answer}</p>
    </div>
  );
}
