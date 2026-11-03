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

/** The band's copy: its marker, and the three steps in order. */
export interface SetupSectionCopy {
  eyebrow: string;
  steps: SetupStep[];
  /** One paragraph under the steps, saying what the setup does NOT require. */
  closing: string;
}
