import { HERO_COPY } from './HeroCopy.constants';

/**
 * The hero's promise: one line, set at the page's largest display step, in the band's
 * right column.
 *
 * `text-display-xl` is a clamp from 48px to 80px, the system's own step for a page's
 * identity. "Get paid." is four characters of wide type at 80px, so it holds ONE line
 * in the right column and does not wrap the way the old "Pay by name." did across two
 * — the column it sits in is the composition's wide half (six of twelve, ~590px at
 * `max-w-6xl`), and a promise that fits its column in one line is what lets the
 * sentence and the actions under it hang from a single left edge.
 *
 * It used to take a reader, because the page carried two promises. It carries one now
 * (`HeroCopy.constants.ts`).
 *
 * THE LEADING TRIM IS OPTICAL, AND IT IS MEASURED AGAINST THE CODE. The line box of a
 * display step carries leading above the caps, so an `items-start` row would put the
 * headline's box top level with the plate and its CAP about 11px below the plate's top
 * edge — two objects that look staggered while being geometrically aligned. `-0.132em`
 * is the leading `text-display-xl` adds above the cap, so the promise's cap line lands
 * on the plate's edge. The same trim moved a centred group's optical centre in an
 * earlier version of this band; here it is doing the only job it has.
 */
export function HeroHeadline() {
  return (
    <h1 className="entrance font-brand text-display-xl font-medium text-on-dark md:-mt-[0.132em]">
      {HERO_COPY.headline}
    </h1>
  );
}
