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
 * NO MINIMUM HEIGHT AND NO JUSTIFICATION (#540). The tile used to be `min-h-[13rem]` with
 * `justify-between`, which pinned the sentence to the foot of the tile and left ~85px of
 * nothing between it and the label: a hole in the middle of every card, in the one band
 * whose whole job is three short facts. The sentence now follows the label at 8px and the
 * tile is as tall as its words. The row still reads level because grid items stretch to the
 * tallest tile by default, so the three cards keep one height without a hard-coded one.
 *
 * THE TILE IS A SQUARE ON THE REFERENCE AND A CONTENT-SIZED CARD HERE, and the difference
 * is content rather than taste. cash.app's squares hold a photograph, a big figure and a
 * floating UI chip, so 331px of tile is 331px of object. These hold a heading and one
 * sentence, and the two rounds before this one both put space inside the tile to fake a
 * square: `sm:aspect-square` left ~140px of nothing, and `min-h-[13rem]` with
 * `justify-between` left ~85px. Both were potholes read as a missing image rather than as
 * whitespace, which is the trade #540 records above. The tile now takes its height from what
 * is in it, the grid gives the row one height, and the radius stays this system's 12px.
 */
export function MoneyCard({ tile }: MoneyCardProps) {
  return (
    <li className="flex flex-col rounded-md border border-hairline-dark bg-surface-elevated p-5 sm:p-6">
      <h3 className="font-brand text-heading-sm font-medium text-on-dark sm:text-heading-md">
        {tile.label}
      </h3>
      <p className="mt-2 text-body-sm text-on-dark-mute">{tile.detail}</p>
    </li>
  );
}
