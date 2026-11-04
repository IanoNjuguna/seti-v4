import { BrandLockup } from '@/components/ui';
import { FOOTER_COLOPHON } from './LandingFooter.constants';

/**
 * The last line of the site: the lockup, and who made this where.
 *
 * `BrandLockup` and not `BrandMark` + a word: the lockup is the drawn object from
 * `design-kit/seti-world/navbar.png`, and the nav wears the same one. Rebuilding the
 * mark-and-word here in type is how a kit ends up with two versions of one asset, and
 * the lockup carries the accessible name, so a `<p>` beside it does not have to.
 *
 * The colophon is `caption` in `stone` — the design doc's role for metadata, measured
 * at 6.9:1 on this canvas — with the year's build stamp from `LandingFooter.constants.ts`
 * rather than a clock (the deployed Worker's clock once answered 0, #270).
 *
 * It is flushed to `canvas-dark` with no border of its own: the index above it already
 * carries the hairline, and two rules 24px apart read as a mistake.
 */
export function FooterRail() {
  return (
    <div className="flex flex-col items-start gap-6 border-t border-hairline-dark pb-10 pt-8 md:flex-row md:items-center md:justify-between md:pb-12">
      <BrandLockup className="h-7" />
      <p className="font-tabular text-caption text-stone">{FOOTER_COLOPHON}</p>
    </div>
  );
}
