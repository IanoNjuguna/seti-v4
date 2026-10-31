import type { ReactNode } from 'react';

/**
 * The band header, and it is the same shape in every band on the page.
 *
 * Taken from cash.app's measured section rhythm: the eyebrow, then the heading,
 * then one line of prose under it, all on the band's left edge, with the band's
 * content starting a fixed step below. Every band on that page opens exactly this
 * way, which is what makes a long page read as one document rather than as five
 * unrelated layouts — and it is what this page was missing when each band carried
 * its own idea of a heading.
 *
 * THE HEADING IS OPTIONAL NOW (#288). The owner deleted the three display headings the
 * bands carried — "How people pay you.", "Paid to you, held by you.", "No hidden
 * charges" — because each one restated what the band's marker and its content already
 * said. With no title, the marker is promoted to the band's `h2` (`SectionEyebrow`
 * `as="h2"`): the band keeps a heading in the outline, and the render is unchanged.
 */
export interface SectionHeaderProps {
  /** The band's marker word, set in caption size by `SectionEyebrow`. */
  eyebrow: string;
  /**
   * The band's heading. One line of 40px at `sm` and up, by the design system.
   *
   * Optional: omit it and the eyebrow becomes the band's heading instead. A band whose
   * marker already names it does not need a second line saying the same thing.
   */
  title?: string;
  /**
   * One sentence under the heading. Optional because a band with nothing extra to
   * say should not be handed filler: `#partners` carries no heading at all (its
   * h2 was deleted deliberately) and this header is not used there.
   */
  lede?: string;
  /** True on a dark band, where every ink in the header inverts. */
  onDark?: boolean;
  /** Content placed on the band's trailing edge, level with the lede. */
  trailing?: ReactNode;
}
