import type { HeroCopy } from './HeroCopy.types';

/**
 * The hero's words.
 *
 * ONE READING, and it is the merchant's. The page used to render two, chosen by a
 * Personal | Business control in the navbar and carried in the URL as `?for=`. The
 * control is gone: a visitor arriving at seti.live is deciding whether to use the
 * product, not which of two brochures to read, and the merchant's reading is the one
 * that names what the page is for. The words below are the business variant's,
 * unchanged, because they were already the owner's.
 *
 * WHY THE MERCHANT'S AND NOT THE CUSTOMER'S: a customer paying a merchant is doing
 * the thing the page describes; a merchant reading a page that says "Pay by name" is
 * being told to do somebody else's job. The reading kept is the one whose action the
 * hero can actually take a reader to — `Claim your name` lands in onboarding, where
 * the name is claimed (both actions point at `SIGN_IN_PATH`).
 *
 * `lede` OPENING WITH THE ACTION IS DELIBERATE, and it is the owner's string: the
 * sentence announces the step, the button under it offers the step. What the band
 * does not do is repeat the promise — "Get paid." is the claim, the sentence is the
 * method, and the button is the first move of the method.
 *
 * EVERY SENTENCE IS ONE THE CODE CAN BACK. There is no monthly fee and no minimum
 * (`FeesSection.constants.ts`), a name is claimed in onboarding, a printable code is
 * produced there (`components/merchant/MerchantQr.tsx`, "Print this as your sticker"),
 * and a payment goes straight to the payee's own balance. Nothing here promises a
 * dashboard, an invoice, a card, M-Pesa or an off-ramp, because none of those exist
 * in v1.
 *
 * THE HEADLINE DOES NOT NAME THE CURRENCY, which is unchanged on purpose: the hero is
 * deliberately currency-free and the first figure on the page belongs to the band
 * below it. `layout.tsx`'s document title still carries "dollars" for the tab and for
 * a search result.
 */
export const HERO_COPY: HeroCopy = {
  headline: 'Get paid.',
  lede: 'Claim your name. Customers pay you by name or by scanning your code.',
  primaryAction: 'Claim your name',
  secondaryAction: 'See how it works',
  /**
   * THE ONE CLAIM THAT IS SETI'S OWN, placed where the reader decides.
   *
   * A merchant's first question about a payments product is who ends up holding the
   * money, and this page could answer it in the only way that matters: the payment goes
   * from the payer's wallet to the merchant's own wallet and the platform never takes
   * possession. That is true of the code (`services/settlement.ts` plans a swap the
   * customer's own wallet signs; `check:refusals` fails the build if a signing client
   * ever appears in `backend/src`), so it is stated once, plainly, under the buttons
   * rather than only in step three of the band below (#276).
   *
   * Two sentences, because the first says what happens and the second is the absence a
   * merchant is actually asking about. The absence is a real one and it is stated once,
   * at the CTA, which is the only place the copywriting skill allows a negation.
   */
  proof: 'The money lands in your own wallet. Seti never holds it.',
};
