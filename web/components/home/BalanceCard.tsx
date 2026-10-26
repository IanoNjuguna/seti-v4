'use client';

import { BalanceFigure } from './BalanceFigure';
import { BalanceNote } from './BalanceNote';
import { BalanceTokens } from './BalanceTokens';
import type { BalanceCardProps } from './BalanceCard.types';

/**
 * The hero: the balance, on the system's dark canvas.
 *
 * `canvas-dark` is how the Revolut system signals a premium focal surface, and
 * it is what makes the balance read as the most important thing on the screen
 * without a shadow (the system has none) or an accent colour (cobalt is
 * reserved for links).
 *
 * It carries the site's grain at the landing's own strength: this is the one
 * screen whose text is large enough to pay for the texture, and it is the object
 * that should read as the same material as the page a customer arrived from. The
 * layer is `absolute` inside the card, so the working canvas below stays flat;
 * `overflow-hidden` keeps the noise inside the 12px radius, and `relative` is
 * what the layer is positioned against.
 *
 * The card is the SURFACE and one of two bodies, which is the whole of this
 * file: a confirmed account gets its figure (`BalanceFigure`) and, under it, what that
 * figure is made of (`BalanceTokens`); everybody else gets one sentence where the
 * figure would be (`BalanceNote`). Splitting the body out is what keeps the dark
 * surface, the label and the place on the screen identical in both — a visitor is shown
 * the product, not a different card.
 *
 * The list is a SIBLING of the figure rather than a prop of it, because the figure is
 * the sentence and the rows are the composition: one owns the label and the eye, the
 * other owns the breakdown. Both inside this surface, so the card reads as one object.
 *
 * One thing, the balance. Pay and Receive — and the panels they open — are the two
 * buttons below, each on a page of its own. A hero that is also a menu is neither.
 */
export function BalanceCard({ data, view, onSwapped }: BalanceCardProps) {
  return (
    <section
      aria-labelledby="balance-heading"
      className="relative overflow-hidden rounded-md bg-canvas-dark p-6 text-on-dark sm:p-8"
    >
      <div aria-hidden="true" className="surface-grain" />
      {view === 'signed-in' ? (
        <>
          <BalanceFigure data={data} />
          <BalanceTokens assets={data?.assets} currency={data?.currency} onSwapped={onSwapped} />
        </>
      ) : (
        <BalanceNote view={view} />
      )}
    </section>
  );
}
