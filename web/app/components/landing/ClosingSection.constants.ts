/** The closing band's copy. */
export interface ClosingCopy {
  /**
   * The last sentence the page says. The ⌘K palette's label for this band is this
   * heading (`SEARCH_SECTIONS` in `LandingNav.constants.ts`), so the two must stay one
   * string: renaming the band without renaming the label leaves the palette pointing
   * at a heading a reader cannot find.
   */
  heading: string;
  /** The band's one action, 2 to 4 words. */
  action: string;
  /**
   * What the reader gets by pressing it, in the two facts they would ask about.
   *
   * The button is the page's second and last decision point and it used to ask for the
   * action with nothing under it (#276). Both facts are the price list's, said again in
   * the reader's own terms: there is no monthly fee, and the 2% is funded by the
   * customer inside the payment rather than billed to the merchant
   * (`backend/src/services/fees.ts` is the source of truth for that).
   */
  reassurance: string;
}

/**
 * The closing band.
 *
 * The heading is the action itself, in the words a reader would say out loud: the
 * owner cut the paragraph under it and asked for the request to be made directly.
 * Nothing is added back.
 *
 * THE ACTION IS THE MERCHANT'S, and it was the one thing that differed between the
 * page's two readings: a business claims the name it will be paid by, a person simply
 * opened the app. Saying "Claim your name" to somebody who is about to send money was
 * asking them to do something that is not their job, which is why the personal reading
 * said "Open Seti". The personal reading is gone (`HeroCopy.constants.ts`), so the
 * claim is the page's single close. Both labels always landed on `SIGN_IN_PATH`: the
 * claim happens inside the product, in onboarding.
 *
 * There is no testnet line and no network sentence under this button, which is how
 * this band shipped before this change. That is recorded as a real loss rather than
 * a design choice: a visitor is invited to open the product on copy that implies
 * live money, and nothing on the landing page names the network any more. Fixing
 * it belongs to a page-level statement, not to a line re-added here.
 */
export const CLOSING_COPY: ClosingCopy = {
  heading: 'Sign in today',
  action: 'Claim your name',
  reassurance: 'No monthly fee. Your customers cover the 2%.',
};
