import Link from 'next/link';
import { ButtonLink } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { CLOSING_COPY } from '../landing/ClosingSection.constants';
import type { MarketingCloseProps } from './MarketingClose.types';

/**
 * The close, in the landing's own words: `CLOSING_COPY`'s heading, action and reassurance,
 * because a reader who has just read the price should not meet a second version of it on
 * the way out. The strings are imported, never copied, so the two page-level closes cannot
 * drift.
 *
 * THE LAST LINE IS THE ONE THING THE LANDING'S CLOSE CANNOT CARRY: a link to the sibling
 * page. `/` ends on a button and nothing else, because on `/` there is nothing left to read.
 * `/pricing` and `/how-it-works` are halves of one argument — what it costs, and how it
 * works — so a reader who has finished one is the likeliest reader of the other, and the
 * link is here rather than in a footnote.
 *
 * IT SITS UNDER THE REASSURANCE, NOT BESIDE THE BUTTON, so it never competes with the
 * decision: the button is the action, this is the next question. It is a `min-touch` target
 * for the same reason the footer's legal links are — a text-height anchor is under the 44px
 * floor this system keeps everywhere else.
 *
 * `ButtonLink` for the action rather than `<Link><Button>`, because the anchor IS the
 * control and a keyboard user tabs once.
 */
export function MarketingClose({ link }: MarketingCloseProps) {
  return (
    <section className="relative z-10 border-t border-hairline-dark bg-canvas-dark pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-end gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-7">
            <h2 className="max-w-lg font-brand text-heading-lg font-medium text-on-dark sm:text-display-md">
              {CLOSING_COPY.heading}
            </h2>
          </div>

          <div className="flex flex-col gap-4 md:col-span-5 md:items-end">
            <ButtonLink href={SIGN_IN_PATH} variant="on-dark" fullWidth className="sm:w-auto">
              {CLOSING_COPY.action}
            </ButtonLink>
            <p className="text-body-sm text-on-dark-mute md:text-right">
              {CLOSING_COPY.reassurance}
            </p>
            <Link
              href={link.href}
              className="inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-on-dark-mute underline-offset-4 transition-colors duration-(--duration-quick) ease-out hover:text-on-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
            >
              {link.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
