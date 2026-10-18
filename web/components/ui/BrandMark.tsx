import Image from 'next/image';
import { cn } from '@/lib/cn';
import { BRAND_MARK_SIZE, BRAND_MARK_SRC } from './BrandMark.constants';
import type { BrandMarkProps } from './BrandMark.types';

/**
 * Seti's mark: an alien head, in the two expressions the identity allows.
 *
 * The expression is a ROLE, not a mood, and it is written where the mark is
 * drawn rather than chosen per screen: `neutral` wherever the product identifies
 * itself (chrome, documents, the tab, the home screen) and `friendly` only where
 * it addresses a person (sign-in, onboarding, an empty screen, a payment that
 * worked). Picking between them by eye is how a brand ends up with both faces in
 * one flow and neither of them meaning anything.
 *
 * `canvas` follows the surface's own canvas token, because the two colourways
 * are not interchangeable: the cream mark is 1.3:1 on white and the white one
 * does not exist on black.
 */
export function BrandMark({ expression, canvas, className, label, preload }: BrandMarkProps) {
  return (
    <Image
      src={BRAND_MARK_SRC[expression][canvas]}
      alt={label ?? ''}
      width={BRAND_MARK_SIZE}
      height={BRAND_MARK_SIZE}
      preload={preload}
      className={cn('w-auto select-none', className)}
      draggable={false}
    />
  );
}
