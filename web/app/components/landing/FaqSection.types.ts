/**
 * One question, and the answer a reader reads without pressing anything.
 *
 * `question` and `answer` are also the two strings `web/lib/faq-schema.ts` puts into
 * the page's `FAQPage` node, so the visible band and the structured data are the same
 * bytes read twice rather than two copies of one claim.
 */
export interface FaqEntry {
  question: string;
  answer: string;
}

/** The questions band: its heading and the six entries, in order. */
export interface FaqSectionCopy {
  /**
   * The band's heading, and it is the band's `h2`. It is also its marker: the copy
   * carries one string for this band rather than an eyebrow and a heading, and the page's
   * established pattern for a band whose name is its heading is to promote the marker to
   * the `h2` (see `SectionHeader`).
   */
  heading: string;
  /** Exactly six, in the order they are asked. */
  items: FaqEntry[];
}
