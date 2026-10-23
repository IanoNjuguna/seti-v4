import { HeroActions } from './HeroActions';
import { HeroHeadline } from './HeroHeadline';
import { HeroPaymentQr } from './HeroPaymentQr';
import type { AudienceProps } from './Audience.types';

/**
 * The hero: three columns on one bottom line, the page's own object in the middle.
 *
 * THE COMPOSITION IS THE REFERENCE'S, measured rather than guessed. cash.app's
 * hero at 1440x900 is a promise in the left third (448px), a product object dead
 * centre (437px) that is TALLER than the copy and so rises past it, and the
 * sentence plus its one pill in the right third (331px). Their bottom edges land
 * within 30px of each other, which is what makes the band read as one object
 * instead of three blocks at three heights. That is `md:items-end` here: the grid
 * aligns every column to the same bottom edge, the QR column is the tallest, and
 * the two text columns sit at its foot.
 *
 * THE GROUP IS CENTRED IN THE BAND, NOT PINNED TO ITS BOTTOM, and that is measured
 * rather than chosen. The reference's hero content sits in the middle two thirds of
 * its 900px band (promise from y 484, block from 174 to 770) rather than resting on
 * the fold. A group pinned to the bottom of a full-height band leaves an empty top
 * third here, because this page's object is a 380px QR plate and not a 720px phone
 * that bleeds off both edges of the band. So `justify-center` splits the leftover
 * height above and below the group; bottom alignment spent all of it at the top.
 *
 * WHAT THIS REPLACED. The band was two halves, seven/five, copy left and the code
 * right, with the copy centred on its column's middle and the code centred on its
 * own. Both halves carried long arguments in this file's history about optical
 * centres agreeing to 0.2px, and the result was still a document: a headline and a
 * picture facing each other across a gutter. Putting the object in the middle is
 * what gives the band a focal point and makes the hero show the product instead of
 * describing it.
 *
 * ORDER ON A PHONE IS NOT THE DESKTOP ORDER. In the DOM the promise is first, the
 * sentence and its action second, and the code last, so a phone reader gets the
 * words, then something to do, then the thing itself. `md:order-*` puts the code
 * back in the middle on a wide screen, where there is room for three columns.
 *
 * `grid-cols-1` on the phone is load-bearing rather than tidy: without it the
 * single implicit column is `auto`, which sizes to an item's MIN-CONTENT, and the
 * printed URL under the code (one unbreakable string) would push the page past the
 * viewport at 360px. An explicit `minmax(0, 1fr)` track caps it.
 *
 * The three columns are 5/4/3 of twelve, not thirds. The promise and the sentence
 * are not the same object and should not be the same width; the code gets the
 * middle four, which at `max-w-6xl` is 347px, 85px more than the 262px plate it
 * holds, so the plate has air on both sides and the caption's ragged right does
 * not touch it.
 */
export function HeroSection({ audience }: AudienceProps) {
  return (
    <section id="hero" className="relative z-10">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center px-6 pb-16 pt-28 md:pb-20 md:pt-32">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:items-end md:gap-8">
          <div className="md:col-span-5">
            <HeroHeadline audience={audience} />
          </div>

          {/* The actions come SECOND in the DOM, so a phone reads the promise and
              then something to do; `md:order-3` puts them back on the right of the
              three columns on a wide screen, where the code takes the middle. */}
          <div className="md:order-3 md:col-span-3">
            <HeroActions audience={audience} />
          </div>

          <div className="md:order-2 md:col-span-4">
            <HeroPaymentQr />
          </div>
        </div>
      </div>
    </section>
  );
}
