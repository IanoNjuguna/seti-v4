import type { Audience } from './Audience.types';

/** The hero's words, as one block: the promise, the sentence, the two actions. */
export interface HeroCopy {
  /** The promise. Cash.app's hero is one short line, not a sentence. */
  headline: string;
  /** One sentence that says what the promise means, in the reader's own terms. */
  lede: string;
  /** The primary action, 2 to 4 words. */
  primaryAction: string;
  /** The quiet second action, 2 to 4 words. */
  secondaryAction: string;
}

/** One hero, two readers. The shape cannot fork; only the words can. */
export type HeroCopyByAudience = Record<Audience, HeroCopy>;
