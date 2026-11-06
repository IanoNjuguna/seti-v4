import type { FaqEntry } from './FaqSection.types';

/** Props of one question in the questions band. */
export interface FaqItemProps {
  entry: FaqEntry;
  /** Ships the row already expanded. Used for the first question only (#363). */
  open?: boolean;
}
