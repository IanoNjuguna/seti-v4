import Link from 'next/link';
import { ButtonLink } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { HERO_COPY } from './HeroCopy.constants';
import { QUIET_ACTION_CLASSES } from './HeroActions.constants';

/**
 * The hero's right column under the promise: the sentence that says how it works, and
 * the one action that opens the product.
 *
 * A ROW ON A WIDE SCREEN, A STACK ON A PHONE. "Claim your name" is the filled white
 * pill (`on-dark`, the doc's `button-primary`); "See how it works" is a quiet text
 * link, not a second button — an outlined box beside the filled CTA makes the row two
 * actions of equal weight and sets the reader choosing between them instead of being
 * offered one thing to do and one thing to read. They sat stacked when this column
 * was the narrow third of a three-column band (~250px, where a 48px pill and a text
 * link cannot share a line). The column is the wide half now, so they share a
 * baseline from `sm` up and stack below it, where 48px of page padding leaves a 360px
 * phone less than the 320px the pair needs.
 *
 * `items-center` is load-bearing and not symmetry: the pill is 48px and the link is a
 * text line ~20px tall, so aligning their tops would hang the link 28px below the
 * pill's own baseline. Centring the link on the pill's height puts both on one
 * optical line.
 */
export function HeroActions() {
  return (
    <>
      <p className="entrance entrance-2 mt-6 max-w-md text-body-lg text-on-dark-mute">
        {HERO_COPY.lede}
      </p>

      <div className="entrance entrance-3 mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        <ButtonLink href={SIGN_IN_PATH} variant="on-dark">
          {HERO_COPY.primaryAction}
        </ButtonLink>

        <Link href="#how" className={QUIET_ACTION_CLASSES}>
          {HERO_COPY.secondaryAction}
        </Link>
      </div>
    </>
  );
}
