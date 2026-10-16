'use client';

import { BalanceFigure } from './BalanceFigure';
import { BalanceNote } from './BalanceNote';
import type { BalanceCardProps } from './BalanceCard.types';

/**
 * The hero: the balance, on the system's dark canvas.
 *
 * `canvas-dark` is how the Revolut system signals a premium focal surface, and
 * it is what makes the balance read as the most important thing on the screen
 * without a shadow (the system has none) or an accent colour (cobalt is
 * reserved for links).
 *
 * The card is the SURFACE and one of two bodies, which is the whole of this
 * file: a confirmed account gets its figure (`BalanceFigure`), everybody else
 * gets one sentence where the figure would be (`BalanceNote`). Splitting the
 * body out is what keeps the dark surface, the label and the place on the screen
 * identical in both — a visitor is shown the product, not a different card.
 *
 * One thing, the balance. Deposit and Send — and the panels they opened inside
 * this card — are tiles in the quick-actions strip below, each on a page of its
 * own. A hero that is also a menu is neither.
 */
export function BalanceCard({ data, view }: BalanceCardProps) {
  return (
    <section
      aria-labelledby="balance-heading"
      className="rounded-md bg-canvas-dark p-6 text-on-dark sm:p-8"
    >
      {view === 'signed-in' ? <BalanceFigure data={data} /> : <BalanceNote view={view} />}
    </section>
  );
}
