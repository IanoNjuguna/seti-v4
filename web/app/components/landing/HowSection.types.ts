/** One numbered step in the "How it works" sequence. */
export interface HowStep {
  /** Rendered tabular, so three steps line up as a column of figures. */
  index: string;
  title: string;
  body: string;
}

/**
 * One band's worth of the mechanic, as the reader's own case describes it.
 *
 * The steps keep their shape and their order; what the copy describes is the
 * merchant's mechanic — found by a name and by the code it prints.
 */
export interface HowSectionCopy {
  /** The band's heading. */
  title: string;
  /** One sentence under it, naming how money reaches the reader. */
  lede: string;
  /** The three steps, in order. */
  steps: HowStep[];
}
