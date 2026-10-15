'use client';

import type { CSSProperties } from 'react';
import { TransactionRow } from '@/components/ui';
import type { HomeActivityProps } from './HomeActivity.types';

/**
 * The home screen's recent rows: what the account did, as page-level list rows
 * on the canvas.
 *
 * THE DESIGN CALL — the populated list is ROWS, not a card. This is the one
 * place the choice lives. The section's words are the page's
 * (`HOME_PAGE_COPY`, `web/app/app/page.tsx`); this brings only the objects.
 *
 * A card around a list of rows draws a box around a box: the row primitive
 * already draws its own edge (`border-b border-hairline-light`, in
 * `TransactionRow`'s `ROW_CLASS`), so the surrounding `border border-hairline-light
 * rounded-md` was a second rectangle 12px off the rows' own square corners — and
 * the empty state beside it wore a radius of its own too. Three radii over one
 * idea is what makes a surface read as machine-assembled rather than designed.
 * The separators carry the grouping here and the page's own heading carries the
 * meaning, so nothing is plated.
 *
 * The only rule the list adds is the trailing edge: a separator belongs BETWEEN
 * two rows, so the last row's hairline is suppressed. `[&>li:last-child>*]`
 * lands one pseudo-class of specificity above the row's baked `border-b`, which
 * a plain `border-b-0` on the descendant selector would not (equal specificity
 * would be decided by the order Tailwind emits the two rules, which `cn()`'s
 * join does not control). There is deliberately no `divide-y` either: the row
 * already draws the line, and a second rule flush beside it read as one thick
 * seam.
 *
 * The rows arrive with a 4px rise and a 24ms stagger, capped at six
 * (`app/app/motion.css`): a list settling explains that it is a list, and the cap
 * is what stops the fifth and sixth rows from performing. It is `transform` and
 * `opacity` only, under `--duration-base`, and reduced motion makes the rows
 * simply appear.
 *
 * No margin of its own: the header-to-content step belongs to the page that
 * stacks the heading over it (`web/app/app/page.tsx`), so the rows and the one
 * empty sentence sit in exactly the same place.
 */
export function HomeActivity({ transactions }: HomeActivityProps) {
  return (
    <ul className="[&>li:last-child>*]:border-b-0">
      {transactions.map((transaction, index) => (
        <li
          key={transaction.id}
          className="row-enter"
          style={{ '--i': index } as CSSProperties}
        >
          <TransactionRow transaction={transaction} />
        </li>
      ))}
    </ul>
  );
}
