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
 * The steps keep their shape and their order across both audiences; what changes
 * is the MECHANIC in the first one, because that is the only step where a person
 * and a business genuinely differ: a person is found by a username or a link, a
 * business by its name and the code it prints.
 */
export interface HowSectionCopy {
  /** The band's heading. */
  title: string;
  /** One sentence under it, naming how money reaches the reader. */
  lede: string;
  /** The three steps, in order. */
  steps: HowStep[];
}
