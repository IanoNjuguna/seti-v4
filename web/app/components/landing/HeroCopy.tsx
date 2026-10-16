import Link from 'next/link';
import { ButtonLink } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { HERO_COPY } from './HeroCopy.constants';

/**
 * The quiet secondary action, as one string.
 *
 * A link on the dark canvas: the footer's recipe (`text-on-dark-mute`, hover to
 * `on-dark` and underline), carrying the CTA's own label type so the row reads as
 * one line of actions, plus `min-touch` for the 44px target and `w-fit` so that
 * target holds the label instead of spanning the row.
 *
 * It is NOT the `ghost` button variant, deliberately: that variant draws its label
 * in `{colors.link}` (cobalt), and the doc is explicit that links on the dark
 * canvas step up in weight in `{colors.on-dark}` instead of taking the cobalt —
 * #376cd5 measures 4.27:1 on black, under AA at this size, while the muted white
 * measures 10.5:1. `cn()` is a plain join rather than a merge, so a colour passed
 * beside a variant's own would be decided by Tailwind's emission order instead of
 * by intent; the recipe is therefore written here, as one string, and there is no
 * second colour on the element. It lives in this file rather than in
 * `HeroCopy.constants.ts` because it is this one row's — the constants file is the
 * hero's copy and stays copy.
 */
const QUIET_ACTION_CLASSES =
  'inline-flex min-touch w-fit items-center rounded-sm text-button font-semibold text-on-dark-mute underline-offset-4 transition-colors duration-(--duration-quick) ease-out hover:text-on-dark hover:underline active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark';

/**
 * The hero's words, as ONE GROUP CENTRED ON ITS COLUMN'S MIDDLE.
 *
 * The half is a centred grid (its grid and its anchoring are set by
 * `HeroSection`), and these three lines are the group's three rows: the headline,
 * the lede, then the two actions. They are NOT three bands the column distributes
 * between its top and bottom edges — that is the change here, and the reason each
 * line carries its own top margin instead of an alignment: `mt-6` (24px,
 * `{spacing.xl}`) under the headline and `mt-8` (32px, `{spacing.xxl}`) above the
 * actions are the group's two steps. Both are the doc's own rungs, one closer than
 * the other so the promise and the line qualifying it read as one thought and the
 * actions read as the next thing. The rows' own `self-*` alignment classes are
 * gone with the distribution: under `content-center` every row is exactly its
 * content's height, so an alignment inside it had nothing left to move, and the
 * margins are now the only thing placing a line.
 *
 * The mobile margins that remain are those same two steps, so a phone reads the
 * same composition at the same distances.
 *
 * THE SECOND ACTION IS A LINK, NOT A SECOND BUTTON. "See how it works" used to
 * carry `button-outline-dark` — an outlined box beside the filled white CTA, which
 * made the row two objects of equal weight and set the reader choosing between
 * them rather than being offered one thing to do and one thing to read. It is now
 * a quiet text action: same words, same destination, no fill, no outline, the
 * page's own link treatment for a dark surface (`QUIET_ACTION_CLASSES` above).
 *
 * Still THREE animated things: the entrance is the headline, the lede and the
 * actions, the cap `design/motion.md` DIAL ONE sets. Nothing was added to the
 * stagger, and no new copy was added to the column.
 *
 * The headline is the two-word promise — "Get paid." — and it is deliberately
 * currency-free. Worth knowing what that costs, because it is a real loss: with
 * this wording NOTHING above the fold names the currency. The lede used to carry a
 * second sentence about the money travelling to the merchant (the owner's
 * deletion); the line that replaced it now speaks to the customer instead, so the
 * first mention of dollars on the page is still the next band's second step
 * ("They pay in dollars."), a screen down. `layout.tsx`'s document title still
 * reads "Seti — Get paid in dollars", so the tab and a search result carry the
 * currency even though the hero does not.
 *
 * The old hero led with "a neo-bank", a category nobody asks for, over a stock
 * video of floating coins. This one leads with what lands in your balance.
 */
export function HeroCopy() {
  return (
    <>
      <h1 className="entrance max-w-4xl font-brand text-display-xxl font-medium text-on-dark md:-mt-[0.132em]">
        {HERO_COPY.headline}
      </h1>
      <p className="entrance entrance-2 mt-6 max-w-xl text-body-lg text-on-dark-mute">
        {HERO_COPY.lede}
      </p>
      <div className="entrance entrance-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <ButtonLink href={SIGN_IN_PATH} variant="on-dark" fullWidth className="sm:w-auto">
          {HERO_COPY.primaryAction}
        </ButtonLink>
        <Link href="#how" className={QUIET_ACTION_CLASSES}>
          {HERO_COPY.secondaryAction}
        </Link>
      </div>
    </>
  );
}
