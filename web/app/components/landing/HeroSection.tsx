import { HeroCopy } from './HeroCopy';
import { HeroPaymentQr } from './HeroPaymentQr';

/**
 * The hero: the page's identity, and the owner's own half.
 *
 * TWO HALVES, SEVEN/FIVE — the split the other bands use and the one the owner
 * asked to keep. (It was briefly narrowed to put the copy on a grid third; he
 * corrected that, and the correction is worth keeping: the horizontal proportions
 * were never the problem.)
 *
 * EACH HALF IS A GROUP CENTRED ON ITS COLUMN'S MIDDLE, not content distributed
 * across it. `md:content-center` is the whole of the distribution change: the
 * grid's rows stay at their own content and the column's slack is split above and
 * below the group. The half used to carry `md:content-between`, which fills a
 * column by pushing the headline to its top, the lede to its middle and the
 * buttons to its bottom and leaves the leftover height sitting in the two gaps —
 * measured at 1280x720 that was 128.7px of nothing under the headline and the same
 * again under the lede, where the two steps now measure 24px and 32px. That is the
 * "spread out" the owner saw. Distribution spends the column; a centred group
 * keeps it.
 *
 * THE MIDDLE THIRD IS AN ANCHOR, NOT A CAGE. The owner's constraint is explicit:
 * the group may reach up into the first third and down into the last. Nothing here
 * caps its height to fit the middle band — at 1280x720 the group's ink is 243.6px
 * inside a 396.6px column, so it begins 76.3px down and ends 76.7px short, its
 * headline crossing into the upper third while its buttons sit into the lower one.
 * That overlap is the composition; a group squeezed into the middle third would
 * read cramped.
 *
 * THE STEPS INSIDE THE GROUP ARE THE PAGE'S OWN, and there are two of them:
 * `mt-6` (24px, `{spacing.xl}`) under the headline and `mt-8` (32px,
 * `{spacing.xxl}`) above the buttons — the margins this stack already carried on
 * mobile, with their `md:mt-0` overrides removed so the ladder, and not the column,
 * decides the gaps. Headline and lede are one thought on the closer step; the
 * actions are a different object and take the wider one. Taken from the scale, a
 * step is the same number at every viewport, which is the point: a gap taken from
 * leftover height is a different gap on every screen. (The group's third number is
 * the h1's own leading trim, `-mt-[0.132em]` — measured rather than chosen; see
 * `HeroCopy`.)
 *
 * BOTH HALVES SIT ON ONE HORIZONTAL AXIS. The right half — plate, caption, and the
 * link with its warning — is the taller of the two and sets the band's height
 * (396.6px measured at both widths); the left group is the shorter one and is
 * centred inside that height, and the right half is centred on the same line rather
 * than spread. Measured, the left group's optical centre — the headline's cap down
 * to the buttons' lower edge — lands at 375.8 against a column middle of 376.0 at
 * 1280x720, and at 381.0 against 381.0 at 1360x730, while the right half's centre
 * sits at 376.0 and 381.0. The two centres therefore agree to 0.2px, and the halves
 * read as one composition instead of one tall side and one short side.
 *
 * The h1's trim is what puts the OPTICAL centre on that line instead of 8.5px
 * above it. It takes the line box's leading off the top of the group — 16.9px at
 * the 128px headline, where the measured ink offset is 16.5px — and the em keeps it
 * proportional at every width the `clamp()` picks. The group's own box (leading
 * included) centres at 367.5 at both widths, and the 8.5px between the two readings
 * is exactly the trim's half: the cap marks the group's top visually, so the cap is
 * what belongs on the line. (It is also why the plate's ±2.7px float moves the
 * right half's box centre by only ±1.4px: the float is on the plate.)
 *
 * THE BAND IS SHORTER THAN IT WAS, and that is the right half's doing rather than
 * the centring's: the caption under the plate lost a line (`HeroPaymentQr`), so the
 * taller half needs 396.6px where it needed 444.6px, and the taller half is what
 * the band's height is. Centring decides only where the shorter half sits inside
 * it, and it never inflates a column to fill space — the left group is still
 * exactly its own content.
 *
 * THE ROWS ARE `auto`, WITH `align-content` DOING THE ANCHORING. This is
 * load-bearing and was measured, not guessed. A `1fr` track under an indefinite
 * container height — which is what any of these columns is, since its height comes
 * from its content — resolves every track to the LARGEST track's content:
 * `repeat(3, minmax(min-content, 1fr))` over a 262px plate made all three bands
 * 262px, so the right half stood 834px tall and the hero 1058px, a screen and a half
 * of clipped hero. `auto` rows stay at their content, so nothing inflates and
 * nothing floats: the column's height is still exactly what its content needs.
 * `md:items-stretch` is what makes the two halves one height, so the shorter half's
 * slack is real slack to centre inside rather than a column that simply ends early.
 *
 * Measured in the browser at 1280x720 and 1360x730, motion frozen: each half is
 * 396.6px tall, and the hero's own box is the viewport's height (720 / 730) because
 * the band is a viewport-tall box with its content centred in it. The last line —
 * the warning under the link — ends at 574.3px at 720 and 579.3px at 730: 81.7px
 * and 86.7px above the 656px and 666px folds under the 64px nav, so centring moved
 * the content away from the fold rather than past it. The same two lines were
 * 598.3px and 603.3px (57.7px and 62.7px above those folds) before.
 *
 * `grid-cols-1` is load-bearing, not tidiness: without it the single implicit
 * column is `auto`, which sizes to an item's MIN-CONTENT and lets a wide row (a
 * payment row with a name and a figure that neither may truncate) push the page
 * past the viewport at 360px. An explicit `minmax(0, 1fr)` track caps it. The same
 * applies to the band below, which carries the same fix.
 *
 * The hero used to have an owner-supplied image in the right half. It became a QR
 * of the treasury address, and then — the owner's final call — a QR of a merchant's
 * payment page: the code should open something real, and a treasury code invites
 * strangers to push funds at Seti's fee wallet, while this one opens the thing the
 * product actually does. (The treasury surface that code belonged to has since been
 * deleted from the page entirely.) `public/hero-banner.png` is still in the tree —
 * the owner's asset, kept deliberately — but it is no longer the hero visual.
 *
 * No size was touched to fill space: the type, the copy, the code and the
 * seven/five split are what they were.
 */
export function HeroSection() {
  return (
    <section id="hero" className="relative z-10">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center px-6 pb-20 pt-28 md:min-h-screen md:pb-24 md:pt-32">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:items-stretch md:gap-8">
          <div className="md:col-span-7 md:grid md:content-center">
            <HeroCopy />
          </div>
          <div className="md:col-span-5">
            <HeroPaymentQr />
          </div>
        </div>
      </div>
    </section>
  );
}
