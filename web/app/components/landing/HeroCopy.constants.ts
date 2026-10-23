import type { HeroCopyByAudience } from './HeroCopy.types';

/**
 * The hero's words, one block per reader.
 *
 * TWO PROMISES, because there are two people at this door and they want opposite
 * things said. A person wants to know that paying somebody is easy; a business
 * wants to know that being paid is. The page used to say only the second, which
 * left a customer reading "Get paid." with no route into the product.
 *
 * WHAT IS SHARED IS SHARED: "See how it works" is the same second action in both
 * variants, because the band it opens is the same band. The primary action
 * differs, and both land on `SIGN_IN_PATH` — the claim happens inside the
 * product, in onboarding, so the label promises a step the link leads to.
 *
 * The business copy is the page's OLD copy, kept word for word where it still
 * holds ("Get paid.", "See how it works"), because it was the owner's wording and
 * this change is about giving the customer a voice BESIDE it, not replacing it.
 * The one line rewritten is the lede: "Use Seti to send and receive money."
 * described the product's category rather than naming a thing to do, and in the
 * business variant the reader has a specific one (claim a name, print a code).
 *
 * EVERY SENTENCE IS ONE THE CODE CAN BACK. There is no monthly fee and no minimum
 * (`FeesSection.constants.ts`), a name is claimed in onboarding, a printable code
 * is produced there (`components/merchant/MerchantQr.tsx`, "Print this as your
 * sticker"), and a payment goes straight to the payee's own balance. Nothing here
 * promises a dashboard, an invoice, a card, M-Pesa or an off-ramp, because none
 * of those exist in v1.
 *
 * NEITHER HEADLINE NAMES THE CURRENCY, which is unchanged on purpose: the hero is
 * deliberately currency-free and the first figure on the page belongs to the band
 * below it. `layout.tsx`'s document title still carries "dollars" for the tab and
 * for a search result.
 *
 * The personal lede names a name and a code rather than a link, because the link
 * is printed in full under the hero's own code; a first sentence that opens with
 * `https://` is a sentence written for a machine.
 */
export const HERO_COPY: HeroCopyByAudience = {
  /**
   * Personal: the person paying. The promise is the payer's, because that is who
   * is holding the phone when this page is open.
   */
  personal: {
    headline: 'Pay by name.',
    lede: 'Type a name or scan a code. The money goes straight to them.',
    primaryAction: 'Open Seti',
    secondaryAction: 'See how it works',
  },

  /**
   * Business: the merchant being paid. Two short sentences rather than one long
   * one, and both name a thing the product actually produces: a claimed name, a
   * printed code, and a customer who can pay by either.
   */
  business: {
    headline: 'Get paid.',
    lede: 'Claim your name. Customers pay you by name or by scanning your code.',
    primaryAction: 'Claim your name',
    secondaryAction: 'See how it works',
  },
};
