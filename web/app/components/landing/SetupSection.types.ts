/**
 * One step of getting started, numbered like `how`'s steps because it is a sequence
 * rather than a set.
 */
export interface SetupStep {
  /** Rendered tabular, so the three steps line up as a column of figures. */
  index: string;
  title: string;
  body: string;
}

/** The band's copy: its heading, and the three steps in order. */
export interface SetupSectionCopy {
  /**
   * The band's `h2`. It replaces the caps marker ("Getting started") that used to be
   * promoted to the heading, and says what the three steps span: a name, then a payment.
   */
  heading: string;
  steps: SetupStep[];
  /** One paragraph under the steps, saying what the setup does NOT require. */
  closing: string;
}
