import { WORDMARK_TEXT } from './FooterWordmark.constants';

/**
 * The last band: the name, at the width of the page, cropped by its bottom edge (#353).
 *
 * ## Why it exists
 *
 * The footer used to end on the rail: a 28px lockup and a copyright line at the bottom of a
 * 7,400px page. The page's closing move is a composition rather than a line of metadata, and
 * the name at scale is the only thing this brand can put there that is not a claim.
 *
 * ## Why type and not the lockup
 *
 * `/seti-lockup.png` is 308×112. Used at this width it is a four-times upscale, so the band
 * sets the word in `font-brand` instead: it resolves at every density, needs no new asset, and
 * cannot drift from the setting `design-kit/seti.live/marks/seti-wordmark.svg` was drawn from
 * (same face, same tracking, so the vector is available the day the band should stop depending
 * on a font file).
 *
 * ## The geometry, and where every number comes from
 *
 * Poppins SemiBold, measured from `web/app/fonts/poppins-600.woff2` on 2026-11-06:
 *
 *   - the ink of `seti` at -0.045em tracking is 1.648em wide, side bearings included;
 *   - its ink runs from 0.7969em above the baseline (the `i` dot) to 0.0156em below it;
 *   - with `line-height: 1`, hhea's 1050/1000 ascender puts the ink's top 0.053em BELOW the
 *     line box's top.
 *
 * So `--wm` is the size, `59vw` makes the ink 0.97 of the viewport at 390 and 768, `700px` is
 * the cap because 1152 (the content column) ÷ 1.648 is 699, and the band is 0.69 of the size:
 * it crops the bottom 12% of the ink, which is the move. `pr-[0.045em]` compensates the
 * trailing letter-space, without which a centred word loses 6px of its right edge to the clip.
 *
 * ## What it is not
 *
 * Not a heading, not copy, not a link: `aria-hidden`, unselectable, no pointer events. A crawler
 * and a screen reader both already met this word in the nav's lockup, and a second reading of it
 * at 700px is noise in the outline. The band adds no colour either: one token at one opacity.
 */
export function FooterWordmark() {
  return (
    <div
      aria-hidden="true"
      className="relative h-[calc(var(--wm)*0.69)] overflow-hidden [--wm:clamp(3.5rem,59vw,700px)]"
    >
      <p className="mx-auto mt-[calc(var(--wm)*-0.053)] w-max cursor-default select-none whitespace-nowrap pr-[0.045em] font-brand text-[length:var(--wm)] font-semibold leading-none tracking-[-0.045em] text-on-dark/10">
        {WORDMARK_TEXT}
      </p>
    </div>
  );
}
