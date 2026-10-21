'use client';

import { IconButton } from '@/components/ui';
import type { ConvertFlipProps } from './Convert.types';

/**
 * The flip: exchange the two sides.
 *
 * It sits BETWEEN the rows rather than beside either one, because what it changes
 * is the pair and not a side — a control inside the "you give" well would read as
 * a property of that asset. On a phone it is centred on the hairline between them,
 * which is also where a thumb reaches without covering a figure.
 *
 * It is a real button with a word for a name ("Swap the two assets"), not a
 * decorative glyph: `IconButton` is 44px, which is the tap minimum, and its
 * `aria-label` is the only thing a screen reader can announce from a circle.
 */
export function ConvertFlip({ onClick, label, icon }: ConvertFlipProps) {
  return (
    <div className="-my-1 flex justify-center">
      <IconButton name={icon} label={label} onClick={onClick} surface="light" />
    </div>
  );
}
