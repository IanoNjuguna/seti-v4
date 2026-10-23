import Link from 'next/link';
import { ButtonLink } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { HERO_COPY } from './HeroCopy.constants';
import { QUIET_ACTION_CLASSES } from './HeroActions.constants';
import type { AudienceProps } from './Audience.types';

/**
 * The hero's third column: the sentence that qualifies the promise, and the one
 * action that opens the product.
 *
 * TWO OBJECTS, ONE ABOVE THE OTHER. "Open Seti" is the filled white pill
 * (`on-dark`, the doc's `button-primary`); "See how it works" is a quiet text
 * link, not a second button — an outlined box beside the filled CTA makes the row
 * two actions of equal weight and sets the reader choosing between them instead of
 * being offered one thing to do and one thing to read. Both are 2 to 4 words.
 *
 * The label comes from the reader's own copy block (`HeroCopy.constants.ts`), so
 * the business variant's pill says "Claim your name" and the personal one says
 * "Open Seti", while the destination is the same because the product's front door
 * is the same door.
 *
 * STACKED, NOT IN A ROW. This column is the narrowest of the three (three of
 * twelve at `max-w-6xl`, ~250px), and a 48px pill plus a text link does not fit
 * across it: the row would wrap into exactly this stack with worse spacing. At
 * 360px the page is one column and the stack is right there too, so the mobile and
 * desktop compositions agree.
 */
export function HeroActions({ audience }: AudienceProps) {
  const copy = HERO_COPY[audience];

  return (
    <>
      <p className="entrance entrance-2 max-w-sm text-body-lg text-on-dark-mute">
        {copy.lede}
      </p>

      <div className="entrance entrance-3 mt-8 flex flex-col items-start gap-4">
        <ButtonLink href={SIGN_IN_PATH} variant="on-dark">
          {copy.primaryAction}
        </ButtonLink>

        <Link href="#how" className={QUIET_ACTION_CLASSES}>
          {copy.secondaryAction}
        </Link>
      </div>
    </>
  );
}
