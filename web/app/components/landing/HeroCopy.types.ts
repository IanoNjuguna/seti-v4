/**
 * The hero's words, as one block: the promise, the sentence, and the two actions.
 *
 * It used to be a record keyed by reader, because the page served a person and a
 * business from one URL. It serves one reader now — the merchant, who is the person
 * with a name to claim — so the shape is a single block and a missing variant is
 * no longer something a type can catch, because there are no variants.
 *
 * It also used to carry a `proof` line under the actions — the custody sentence — and
 * that field is gone rather than empty (#288). `HeroCopy.constants.ts` records where the
 * claim lives now and what the landing page lost with it.
 */
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
