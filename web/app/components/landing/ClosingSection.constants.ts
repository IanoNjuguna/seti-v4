import type { ByAudience } from './Audience.types';

/** The closing band's copy, per reader. */
export interface ClosingCopy {
  /**
   * The last sentence the page says. THE SAME FOR BOTH AUDIENCES, deliberately:
   * the ⌘K palette's label for this band is this heading (`SEARCH_SECTIONS` in
   * `LandingNav.constants.ts`), so a heading that changed with the selector would
   * leave the palette naming a band the reader cannot see. The action below it is
   * where the two readers part.
   */
  heading: string;
  /** The band's one action, 2 to 4 words. */
  action: string;
}

/**
 * The closing band.
 *
 * The heading is the action itself, in the words a reader would say out loud: the
 * owner cut the paragraph under it and asked for the request to be made directly.
 * Nothing is added back.
 *
 * THE ACTION DIFFERS because the two readers are being asked for different first
 * steps even though both links land on `SIGN_IN_PATH`: a business is claiming the
 * name it will be paid by, and a person is simply opening the app. Saying "Claim
 * your name" to somebody who is about to send money would be asking them to do
 * something that is not their job.
 *
 * There is no testnet line and no network sentence under this button, which is how
 * this band shipped before this change. That is recorded as a real loss rather than
 * a design choice: a visitor is invited to open the product on copy that implies
 * live money, and nothing on the landing page names the network any more. Fixing
 * it belongs to a page-level statement, not to a line re-added here.
 */
export const CLOSING_COPY: ByAudience<ClosingCopy> = {
  personal: {
    heading: 'Sign in today',
    action: 'Open Seti',
  },
  business: {
    heading: 'Sign in today',
    action: 'Claim your name',
  },
};
