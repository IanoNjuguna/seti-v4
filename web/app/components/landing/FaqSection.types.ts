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
   * The band's `h2`, and the only heading element the band carries. It is set as a heading
   * rather than as the caps marker it used to be (#552): the marker said what shape the
   * band had ("Questions"), the sentence says who is asking and when.
   */
  heading: string;
  /** Exactly six, in the order they are asked. */
  items: FaqEntry[];
}
