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
export function ReceiptFigure({ word, figure, titleId }: ReceiptFigureProps) {
  return (
    <header className="mt-6">
      {/* `text-on-dark-mute!` is deliberate: the `micro` variant bakes its own
          colour (`text-stone`), and Tailwind v4 emits colour utilities
          alphabetically, so `text-stone` is emitted after `text-on-dark-mute` and
          wins at equal specificity. The card has one muted tier, not two. */}
      <Text
        variant="micro"
        as="p"
        color="inverse-muted"
        className="uppercase tracking-widest text-on-dark-mute!"
      >
        {word}
      </Text>

      <Text variant="balance" tabular as="h2" color="inverse" id={titleId} className="mt-1">
        {figure}
      </Text>
    </header>
  );
}
