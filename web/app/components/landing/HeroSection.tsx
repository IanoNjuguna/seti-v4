import { HeroActions } from './HeroActions';
import { HeroHeadline } from './HeroHeadline';
import { HeroPaymentQr } from './HeroPaymentQr';

/**
 * The hero: the product's own object on the left, the words on the right.
 *
 * TWO COLUMNS, AND THE CODE IS THE ONE ON THE LEFT. The band used to be three — promise
 * left, actions right, code in the middle — because it had to hold two readers' words
 * at once and the object was what the middle third could spare. With one reading
 * (`HeroCopy.constants.ts`) there are two things to say and one to show, and the
 * object leads: a stranger's first look lands on a code they can actually scan, and
 * the promise answers what it is for.
 *
 * THE COLUMNS ARE 5 AND 7 OF TWELVE, WHICH IS WHY THEY ARE NOT HALVES. The code opens
 * the grid and the words take column 6 to the band's right edge. The gutter between
 * them is whatever the plate's column leaves over: 441px of column holding a 352px
 * plate, plus one 32px gap, so about 120px of white between the plate's edge and the
 * first letter. That air is doing the most work in the composition — a gutter narrower
 * than the plate's own corner radius reads as a table with two cells rather than as an
 * object and the words about it.
 *
 * The words get the wider column because they are the part that wraps badly: at six
 * columns "Claim your name. Customers pay you by name or by scanning your code." broke
 * to three lines, and a three-line sentence under a one-line promise looks like a
 * paragraph nobody cut. At seven it is two. The paragraph's own `max-w-md` still stops
 * it running the whole width of the column.
 *
 * THE TWO BLOCKS SHARE A TOP EDGE, and that is the alignment the band rests on. The
 * headline's cap line lands level with the plate's top, so the eye reads one row: the
 * object, then what it is for. `md:items-start` rather than `items-center` — centring
 * the shorter words on the taller plate put the promise a third of the way down the
 * band with nothing above it, which is the floating-in-a-gap look this page has been
 * corrected for before. The bottoms differ and that is honest: the plate block carries
 * a caption, a URL and a warning under it that the words have no counterpart for.
 *
 * ORDER ON A PHONE IS NOT THE DESKTOP ORDER. In the DOM the words are first and the
 * code second, so a phone reader gets the promise, the sentence and the action before
 * being shown a code they cannot scan off their own screen; `md:order-1` lifts the code
 * into the left column where there is room for two.
 *
 * `grid-cols-1` on the phone is load-bearing rather than tidy: without it the single
 * implicit column is `auto`, which sizes to an item's MIN-CONTENT, and the printed URL
 * under the code (one unbreakable string) would push the page past the viewport at
 * 360px. An explicit `minmax(0, 1fr)` track caps it.
 */
export function HeroSection() {
  return (
    <section id="hero" className="relative z-10">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center px-6 pb-16 pt-28 md:pb-20 md:pt-32">
        <div className="grid grid-cols-1 gap-14 md:grid-cols-12 md:items-start md:gap-8">
          <div className="md:order-2 md:col-span-7 md:col-start-6">
            <HeroHeadline />
            <HeroActions />
          </div>

          <div className="md:order-1 md:col-span-5 md:col-start-1">
            <HeroPaymentQr />
          </div>
        </div>
      </div>
    </section>
  );
}
