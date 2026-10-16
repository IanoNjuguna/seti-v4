/** One numbered step in the "How it works" sequence. */
export interface HowStep {
  /** Rendered tabular, so three steps line up as a column of figures. */
  index: string;
  title: string;
  body: string;
}
