import type { MoneyCardProps } from './MoneyCard.types';

/**
 * One square of the money band.
 *
 * THE SQUARE IS THE SHAPE, and it is the one place on this page where a big radius
 * would have been right if the system had one. cash.app draws these at roughly
 * 47px of radius on a 331px square (measured: `border-radius: 14.3%`), which is
 * what makes them read as tiles rather than as cards. This system stops at
 * `--radius-lg` (20px, photography chrome) and gives surfaces `--radius-md`
 * (12px), so the square is 12px and the SIZE carries the reference instead: a
 * square of this size at this radius is unmistakably a tile. Rounding it to 47px
 * would mean inventing a radius the doc does not have, which is how a token
 * vocabulary starts growing a second scale.
 *
 * `surface-elevated` rather than `surface-soft`: this band is `canvas-dark`, and on
 * black the elevated step is what a raised surface is. A `surface-soft` tile
 * (#f4f4f4) would be a light card on a dark band, which reads as a form control.
 * The edge is `hairline-dark`, the system's edge for that canvas, and there is no
 * shadow: the luminance step and the hairline ARE the depth here.
 *
 * ON A PHONE THE SQUARE IS DROPPED (aspect ratio only from `sm`). Four squares in
 * one column at 360px would be four 340px tiles, a screenful and a half of nothing
 * but tiles; two across at `sm` and four across at `lg` is the reference's own
 * progression, and a natural-height card on a phone keeps the words where the
 * reader is.
 */
export function MoneyCard({ tile }: MoneyCardProps) {
  return (
    <li className="flex flex-col justify-between gap-6 rounded-md border border-hairline-dark bg-surface-elevated p-5 sm:aspect-square sm:p-6">
      <h3 className="font-brand text-heading-sm font-medium text-on-dark sm:text-heading-md">
        {tile.label}
      </h3>
      <p className="text-body-sm text-on-dark-mute">{tile.detail}</p>
    </li>
  );
}
