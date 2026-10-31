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
 *
 * THE SENTENCE'S MEASURE IS `max-w-2xl` NOW, and the number is the sentence's, not a
 * preference (#288). "Customers pay through your username or by scanning your QR code."
 * is 624px at `text-body-lg` in 64 characters, so the old `max-w-md` (448px) folded it
 * after "by". `max-w-2xl` is 672 and holds it on one line down to a 577px column (the
 * 640 breakpoint), below which a 64-character sentence on two lines is what a phone
 * does anyway. It still stops the paragraph running the whole width of a 820px column,
 * which is the job the constraint had in the first place: a line of body text is read,
 * not measured.
 */
export function HeroActions() {
  return (
    <>
      <p className="entrance entrance-2 mt-8 max-w-2xl text-body-lg text-on-dark-mute">
        {HERO_COPY.lede}
      </p>

      <div className="entrance entrance-3 mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
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
