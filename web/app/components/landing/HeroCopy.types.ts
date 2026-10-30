/**
 * The hero's words, as one block: the promise, the sentence, the two actions, and the
 * one line of proof under them.
 *
 * It used to be a record keyed by reader, because the page served a person and a
 * business from one URL. It serves one reader now — the merchant, who is the person
 * with a name to claim — so the shape is a single block and a missing variant is
 * no longer something a type can catch, because there are no variants.
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
  /**
   * The claim under the actions, at the point of decision.
   *
   * ONE claim, and it is the one no competitor can copy cheaply: the money lands in
   * the merchant's own wallet and Seti never holds it. It was in step three of the
   * band below and in one tile, and never where the reader decides (#276).
   */
  proof: string;
}
