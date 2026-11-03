import { SectionHeader } from '../landing/SectionHeader';
import type { MarketingBandProps } from './MarketingBand.types';

/**
 * One white band, in the landing's own pattern: `border-t border-hairline-light
 * bg-canvas-light py-[var(--band-pad-block)]`, then `SectionHeader`, then the content.
 *
 * THE MARKER IS THE HEADING. Every band on these routes is named by the dictated h2 — "How
 * that compares", "What we are not", "What lands where", "When something goes wrong" — and
 * none of them carries a second line saying it again. So the header is called with no
 * `title` and `SectionEyebrow` renders the marker as the band's h2, the same trade the
 * landing's `fees` and `start` bands made: identical render, a heading in the outline.
 *
 * THE TOP HAIRLINE IS ON THE BAND, not on the header, because it separates one white band
 * from the next; without it two consecutive light bands read as one band with a gap in it.
 * The same reason `SetupSection` carries it under `FeesSection`.
 *
 * NO REVEAL. The landing animates each band in once (`Reveal`, `design/motion.md` dial one)
 * because its bands unfold an argument one screen at a time. These pages are reference
 * sheets: a reader arrives from a search result for one figure and reads down, and a band
 * that fades in as they scroll to it is motion in front of the thing they came for.
 */
export function MarketingBand({ eyebrow, children }: MarketingBandProps) {
  return (
    <section className="relative z-10 border-t border-hairline-light bg-canvas-light py-[var(--band-pad-block)]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow={eyebrow} />
        <div className="mt-10 md:mt-12">{children}</div>
      </div>
    </section>
  );
}
