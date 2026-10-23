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
 * THE TILE IS A SQUARE ON THE REFERENCE AND A 4:3 CARD HERE, and the difference is
 * content rather than taste. cash.app's squares hold a photograph, a big figure and
 * a floating UI chip, so 331px of tile is 331px of object. These hold a heading and
 * one sentence: at `sm:aspect-square` the 265px tile the 4-up grid gives at 1440 put
 * ~140px of nothing between the label at the top and the sentence at the foot, and
 * four potholes in one row read as a missing image rather than as whitespace. So the
 * tile takes a height instead of a side (`min-h-[13rem]`), which keeps the grid, the
 * gutter and the edge-to-edge row the reference has while letting the words sit
 * closer together. The radius stays this system's 12px and the SIZE still does the
 * "tile" work.
 */
export function MoneyCard({ tile }: MoneyCardProps) {
  return (
    <li className="flex flex-col justify-between gap-6 rounded-md border border-hairline-dark bg-surface-elevated p-5 sm:min-h-[13rem] sm:p-6">
      <h3 className="font-brand text-heading-sm font-medium text-on-dark sm:text-heading-md">
        {tile.label}
      </h3>
      <p className="text-body-sm text-on-dark-mute">{tile.detail}</p>
    </li>
  );
}
