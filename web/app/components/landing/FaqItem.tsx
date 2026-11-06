import { Icon } from '@/components/ui/Icon';
import type { FaqItemProps } from './FaqItem.types';

/**
 * One question, and its answer behind a disclosure the browser owns.
 *
 * ## What changed, and what did not (#363)
 *
 * This row used to print question and answer together, with a comment arguing that a control
 * would cost every answer its place in the HTML. The owner asked for a collapsible band, and the
 * argument turns out to be about WHICH mechanism: a native `<details>` keeps the answer in the
 * server-sent markup. Nothing here is conditional, nothing is client-side, and no JavaScript
 * runs, so a crawler, an assistant and the browser's find-in-page still see all nine answers.
 * What a tap changes is which ones are OPEN, which is the reader's business.
 *
 * That is what `check:seo` now pins (10i): not "no `<details>`", but "no `useState`, no
 * `useReducer`, no `'use client'`, and the answer still read from the band's constants" — with
 * the mechanism asserted present, so a future edit cannot quietly turn this into the JS
 * accordion that really does hide answers.
 *
 * ## The details
 *
 * The question is the `<h3>` INSIDE the summary, not a heading above a button: the outline keeps
 * its nine `h3`s and the row's accessible name is the question. The native marker is suppressed
 * (`list-none` plus the WebKit pseudo) because the chevron is the affordance and two markers is
 * one too many; the chevron turns with `group-open`, which Tailwind resolves against the
 * `details[open]` attribute the browser toggles for us.
 *
 * The first row ships `open` on purpose: the band opens with one answer visible, so it reads as a
 * list of questions rather than a stack of closed bars, and a reader with no JavaScript is not
 * asked to interact to see the band's shape.
 *
 * The row's hairline spans the band and the paragraph is capped at `max-w-2xl`, the same
 * treatment `HowSection` gives the body inside its own hairline rows.
 */
export function FaqItem({ entry, open = false }: FaqItemProps) {
  return (
    <details
      className="group border-t border-hairline-dark py-6 first:border-t-0 first:pt-0"
      open={open}
    >
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 [&::-webkit-details-marker]:hidden">
        <h3 className="font-brand text-heading-sm font-medium text-on-dark">{entry.question}</h3>
        <span
          aria-hidden
          className="mt-1 shrink-0 text-on-dark-mute transition-transform duration-(--duration-quick) ease-out group-open:rotate-90"
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </span>
      </summary>

      <p className="mt-3 max-w-2xl text-body-md text-on-dark-mute">{entry.answer}</p>
    </details>
  );
}
