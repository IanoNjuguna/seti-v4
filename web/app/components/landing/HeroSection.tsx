import { HeroActions } from './HeroActions';
import { HeroHeadline } from './HeroHeadline';
import { HeroPaymentQr } from './HeroPaymentQr';

/**
 * The hero: the words on the left, the product's own object on the right.
 *
 * THE SIDES SWAPPED WHEN THE PROMISE GOT LONGER (#288). The band used to lead with the
 * code in five columns and put seven aside for the words, because "Get paid." was four
 * words and the object was what a stranger's first look should land on. The promise now
 * names the speed as well as the payment — "Get paid in seconds.", 772px at the 80px
 * step — so the words take nine columns and the code takes the last three. What that
 * buys besides the width is the LEFT AXIS: the promise starts on the same x as the
 * nav's wordmark and every section header under it, instead of hanging 473px into the
 * page with nothing above it.
 *
 * TWO COLUMNS ONLY FROM `xl`, WHICH IS THE LINE'S DECISION RATHER THAN A BREAKPOINT'S.
 * `text-display-xl` is `clamp(48px, 8vw, 80px)`: it tracks the VIEWPORT, and the column
 * tracks the content box, which is capped at `max-w-6xl`. So between 1000 and 1279 the
 * type stops shrinking (80px) while the column keeps shrinking, and the measured width
 * says so — 820px of column at 1280, 770 at 1100, 713 at 1024, against a line that needs
 * 772. At 1100 it missed by two pixels and broke into "Get paid in / seconds.". Below
 * `xl` the words therefore take the whole content box (1104 at 1280, 961 at 1024, 705 at
 * 768) and the code sits under them, which is also the calmest version of the band: one
 * focal object, then the specimen. The phone breaks the line at about 480px, where a
 * four-word promise on two lines is what every page does.
 *
 * THE BAND IS SIZED BY ITS CONTENT, NOT A SCREEN (#288). It was `min(100svh, 52rem)`,
 * which on any desktop taller than 832px was 832 with ~420px of content centred in it: a
 * third of the band empty under the code. The first attempt capped it at 44rem and the
 * measurement showed that was still 230px of slack top and bottom — the content is 281
 * tall, not the ~420 I had estimated before the proof line came out. 34rem is 544, which
 * is the content (281) plus its own padding (192) with about 35px of air above and below,
 * and the next section is visible below the band. That is the trade, recorded because it
 * is a brand one: the hero no longer fills the screen, it is the page's opening band, which
 * is also what the reference band he compared it to does (~540px).
 *
 * THE CODE IS ANCHORED TO THE BOTTOM, NOT THE TOP (`xl:items-end`). It used to share its
 * top edge with the headline's cap line, and that alignment was the band's whole idea. It
 * stopped working when the promise got to 820px: the code then sat 32px from the last
 * letter of a full-width line, which is a table with two cells rather than an object and
 * the words about it — 820 + 32 + 252 is the content box exactly, so the band was at 100%
 * utilisation and nothing breathed. Bottom-anchored, the code faces the lede and the
 * buttons, where the text is 624 and ~330 wide, so it has air beside it; and with the band
 * shorter it anchors the bottom edge instead of floating above a hole.
 *
 * WHAT IT COSTS, recorded here rather than left in a diff: the object stops leading, and
 * between 768 and 1279 it is not beside the words at all. At `xl` it is one grid column
 * (~252px) instead of 352, and the second thing read rather than the first. The trade
 * holds because the promise is the part that survives a reader who will not scan anything,
 * and on a phone the code is one tap away.
 *
 * NO ORDER UTILITIES ANY MORE. The words were second in the DOM and lifted left by
 * `md:order-1`, because the desktop composition ran against the reading order. The
 * desktop order IS the reading order now, so the promise, the sentence and the action
 * come first in the markup and a phone gets them before a code it cannot scan off its
 * own screen, with nothing to undo.
 *
 * `grid-cols-1` on the phone is load-bearing rather than tidy: without it the single
 * implicit column is `auto`, which sizes to an item's MIN-CONTENT, and the plate is one
 * unbreakable object. An explicit `minmax(0, 1fr)` track caps it.
 */
export function HeroSection() {
  return (
    <section id="hero" className="relative z-10">
      <div className="mx-auto flex min-h-[min(100svh,34rem)] max-w-6xl flex-col justify-center px-6 pb-16 pt-28 md:pb-20 md:pt-32">
        <div className="grid grid-cols-1 gap-14 xl:grid-cols-12 xl:items-end xl:gap-8">
          <div className="xl:col-span-9">
            <HeroHeadline />
            <HeroActions />
          </div>

          <div className="xl:col-span-3">
            <HeroPaymentQr />
          </div>
        </div>
      </div>
    </section>
  );
}
