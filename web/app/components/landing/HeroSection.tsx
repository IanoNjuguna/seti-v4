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
 * WHAT IT COSTS, recorded here rather than left in a diff: the object stops leading, and
 * between 768 and 1279 it is not beside the words at all. At `xl` it is one grid column
 * (~285px) instead of 352, and the second thing read rather than the first. The trade
 * holds because the promise is the part that survives a reader who will not scan
 * anything, and on a phone the code is one tap away.
 *
 * THE COLUMNS STILL SHARE A TOP EDGE AT `xl`, and that is the alignment the band rests
 * on. The headline's cap line lands level with the code's top (`md:-mt-[0.132em]` in
 * `HeroHeadline` does the trimming), so the eye reads one row: the promise, then the
 * object it is about. `xl:items-start` rather than `items-center` — centring the shorter
 * block on the taller one floats it a third of the way down the band with nothing above
 * it, which is the look this page has been corrected for before. Between the two there is
 * one 32px grid gap plus the 48px the headline leaves in its own column, so about 80px of
 * white between the last letter and the code's edge.
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
      <div className="mx-auto flex min-h-[min(100svh,52rem)] max-w-6xl flex-col justify-center px-6 pb-16 pt-28 md:pb-20 md:pt-32">
        <div className="grid grid-cols-1 gap-14 xl:grid-cols-12 xl:items-start xl:gap-8">
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
