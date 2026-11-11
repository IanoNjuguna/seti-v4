import { cn } from '@/lib/cn';
import { TOKEN_MARK_FILES } from './TokenMark.constants';
import type { TokenMarkProps } from './TokenMark.types';

const SIZE_CLASSES = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  /** The size a list row reserves, matching `RowMark`'s 40px well so two lists share one title edge. */
  lg: 'h-10 w-10',
} as const;

const SIZE_PIXELS = { sm: 20, md: 24, lg: 40 } as const;

/**
 * A token's own mark, in a circle.
 *
 * The symbol beside it already names the token, so this is decoration: `alt=""`, no label, and
 * a screen reader hears `OUSD` once rather than twice. What it buys is the glance: `USDC.e` and
 * `USDC` are one character apart in text and unmistakable in brand.
 *
 * CLIPPED TO A CIRCLE, always. pathUSD ships as a black square and the other three as discs, so
 * a row of four marks would read as three brands and a mistake. Clipping normalises the shape
 * without touching the artwork.
 *
 * A label with no vendored file renders nothing at all. An empty `<img>` is a broken-image icon,
 * and an asset can exist on chain before its mark is in `design-kit/`.
 */
export function TokenMark({ asset, size = 'md', className }: TokenMarkProps) {
  const file = TOKEN_MARK_FILES[asset];
  if (!file) return null;

  return (
    <img
      src={`/tokens/${file}`}
      alt=""
      width={SIZE_PIXELS[size]}
      height={SIZE_PIXELS[size]}
      draggable={false}
      className={cn('shrink-0 rounded-full object-cover', SIZE_CLASSES[size], className)}
    />
  );
}
