import { HERO_COPY } from './HeroCopy.constants';
import type { AudienceProps } from './Audience.types';

/**
 * The hero's promise: one line, set at the page's largest display step, in the
 * band's leading column.
 *
 * THE FIRST OF THREE COLUMNS, and the first thing the composition changed.
 * cash.app's hero is not two halves: the promise sits in the LEFT third, the
 * product object owns the middle third and rises above both the promise and the
 * sentence beside it, and the sentence plus its action take the right third. The
 * three share one bottom line (`md:items-end` in `HeroSection`), so the taller
 * object sets the baseline and nothing floats in a gap. Measured on the reference
 * at 1440x900: promise 448px wide, object 437px, sentence 331px, all with their
 * bottom edge inside 30px of each other.
 *
 * `text-display-xl` is a clamp from 48px to 80px, the system's own step for a
 * page's identity. On a desktop column of ~440px the promise wraps to two lines at
 * 80px, which is what the reference's 56px promise does in its 448px column: two
 * lines at a similar proportion to the column, which is the composition. A
 * one-line promise at 48px would read as a section heading rather than as the
 * page's statement.
 *
 * The leading trim (`md:-mt-[0.132em]`) is gone with the centring it served: it
 * pulled the line box's leading off the top so a centred group's optical centre
 * landed on the column's middle. Nothing here is centred on a middle any more,
 * so the trim would only shift the cap height off the bottom line the three
 * columns share.
 */
export function HeroHeadline({ audience }: AudienceProps) {
  return (
    <h1 className="entrance font-brand text-display-xl font-medium text-on-dark">
      {HERO_COPY[audience].headline}
    </h1>
  );
}
