import NextImage from 'next/image';
import { cn } from '@/lib/cn';
import {
  BRAND_LOCKUP_HEIGHT,
  BRAND_LOCKUP_SRC,
  BRAND_LOCKUP_WIDTH,
  BRAND_MARK_SIZE,
  BRAND_MARK_SRC,
} from './BrandMark.constants';
import type { BrandLockupProps, BrandMarkProps } from './BrandMark.types';

/**
 * `next/image`'s default export is the component under a bundler, but under a bare Node
 * loader — `tsx`, which every `check:*` suite renders through — the CommonJS namespace
 * arrives whole (`{ __esModule, default, getImageProps }`), so a plain default import is
 * that OBJECT and React refuses it as an element type: "expected a string … but got:
 * object". `check:pay-states` renders the pay page, the pay page draws its code, and the
 * code carries this mark, so the suite crashed before asserting anything.
 *
 * The unwrap is by element type rather than by `__esModule`, so it is the same
 * expression in both worlds: a function or a `$$typeof` object is the component.
 */
function isElementType(value: unknown): boolean {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  );
}

const Image = (
  isElementType(NextImage)
    ? NextImage
    : (NextImage as unknown as { default: typeof NextImage }).default
) as typeof NextImage;

/**
 * Seti's mark: an alien head, in the two expressions the identity allows.
 *
 * The expression is still a ROLE, not a mood, and it is written where the mark is drawn rather
 * than chosen per screen — but the roles themselves moved (#542), and this block is the rule:
 *
 *  - `friendly` — every CHROME surface (the app dock's head, the landing navbar, the footer rail,
 *    the marketing header) and every moment the product addresses a person (sign-in, onboarding,
 *    an empty screen, a payment that worked).
 *  - `neutral` — DOCUMENTS and the app icon: receipts, statements, legal pages, the favicon.
 *
 * Why the move. `neutral` used to be the rule for all chrome, on the argument that chrome
 * identifies the product and the smile belongs to the moments it speaks. What that produced was a
 * neutral alien in the app's chrome one click from a smiling one on the sign-in page: two faces of
 * one product in one flow, which is the exact failure the "role, not a mood" line was written to
 * prevent. The owner's call is that a customer should meet ONE face everywhere, so the smile is
 * the product's face and `neutral` retreats to the surfaces that are not the product talking —
 * paper, and the icon the OS draws.
 *
 * Picking between them by eye is still how a brand ends up with both faces in one flow and neither
 * of them meaning anything, so: chrome and people get `friendly`, paper gets `neutral`.
 *
 * `canvas` follows the surface's own canvas token, because the two colourways are not
 * interchangeable: the cream mark is 1.3:1 on white and the white one does not exist on black.
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

/**
 * The supplied lockup: the mark and the wordmark as one drawn object.
 *
 * For the chrome surfaces that identify the product — the landing navbar, the footer rail, the
 * marketing header. They used to draw `BrandMark` and set the word beside it in the brand face at
 * a size of their own; that reconstruction could drift (the gap, the weight, the word's size
 * against the row) and it was never the artwork. This is `design-kit/seti-world/navbar.png`,
 * trimmed and served from `web/public`, with the `friendly` face generated from the same file
 * (#542).
 *
 * The name is on the image, not beside it, so `label` defaults to the product's rather than being
 * omitted: an unlabelled lockup inside a link is a link with no accessible name.
 */
export function BrandLockup({ expression = 'friendly', className, label = 'Seti', preload }: BrandLockupProps) {
  return (
    <Image
      src={BRAND_LOCKUP_SRC[expression]}
      alt={label}
      width={BRAND_LOCKUP_WIDTH}
      height={BRAND_LOCKUP_HEIGHT}
      preload={preload}
      className={cn('w-auto select-none', className)}
      draggable={false}
    />
  );
}
