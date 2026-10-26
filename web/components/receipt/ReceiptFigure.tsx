'use client';

import { Text } from '@/components/ui';
import type { ReceiptFigureProps } from './Receipt.types';

/**
 * The figure, and the one word that says what it did.
 *
 * This is the loudest thing on the card: a customer holds the screen up and the
 * other party reads a figure and a direction, nothing else. It is the amount the
 * payee received, taken from the row's own recorded figure — not the transaction
 * total, which on an outgoing transfer also carries the fees.
 *
 * `balance` is the app's own hero type (24px on a phone, 40px from `sm`), and it
 * is the size the document surface already uses for the one number that matters.
 * The dialog's accessible name points at it, so a screen reader announces the
 * proof itself rather than a generic title.
 */
export function ReceiptFigure({ word, figure, assetLine, titleId }: ReceiptFigureProps) {
  return (
    <header className="mt-6">
      {/* One muted tier, not two: `color="inverse-muted"` is the ONLY colour class
          this element carries. It used to need a `text-on-dark-mute!` important
          modifier because the `micro` variant baked its own `text-stone`, which
          Tailwind emitted after it and won. `Text` no longer lets a variant
          outrank an explicit colour, so the modifier is gone. */}
      <Text
        variant="micro"
        as="p"
        color="inverse-muted"
        className="uppercase tracking-widest"
      >
        {word}
      </Text>

      <Text variant="balance" tabular as="h2" color="inverse" id={titleId} className="mt-1">
        {figure}
      </Text>

      {/* The token that moved (#238), one step down and beside the amount rather
          than inside it: the figure stays the fiat sum a customer quotes, and this
          says which stablecoin it was. Absent — not a dash — on a row that recorded
          none, so a legacy receipt is byte-for-byte what it was. */}
      {assetLine ? (
        <Text as="p" variant="micro" color="inverse-muted" className="mt-1">
          {assetLine}
        </Text>
      ) : null}
    </header>
  );
}
