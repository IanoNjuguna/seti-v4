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
 * `lede` SAYS THE METHOD AND ONLY THE METHOD. It used to open with the action
 * ("Claim your name. Customers pay you ..."), so the sentence announced the step, the
 * button under it offered the step and the promise above it said what the merchant
 * gets. The owner's wording drops the opening clause: the button under it is "Claim
 * your name", which is the step, and the sentence now spends its whole length on how a
 * customer pays — a username, or a code.
 *
 * "USERNAME" HERE AND "NAME" ON THE BUTTON is the app's own split rather than a slip:
 * the receive surfaces claim a username (`/u/<handle>`) and the landing page has always
 * spoken about being paid by name, which is what a customer types. Recorded because two
 * words for one thing in two adjacent lines is the kind of thing that is either a
 * decision or a mistake, and nobody can tell from the diff which.
 *
 * THE PROMISE NAMES THE SPEED NOW (#288). It was "Get paid." — true, and short
 * enough to hold one line in the hero's old seven-column half. The promise says when
 * as well as what, because a merchant's second question after "who holds the money"
 * is "how long until I have it", and this product's answer is a good one: a payment is
 * ONE atomic transfer, so it lands in the block that carries it, and Tempo's blocks
 * measured 525ms over 40 blocks on 2026-10-31 (a swap is retried two seconds apart
 * because "a Tempo block is well under a second", `useConvertSwap.ts`). "In seconds"
 * is the claim the code backs; a number like "under two seconds" would not be, because
 * it has never been measured end to end, so it is not here.
 *
 * `lede` still carries the method, and it is unchanged: naming the payee and scanning
 * the code are what a customer does, and the promise above says what the merchant gets.
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
  headline: 'Get paid in seconds.',
  lede: 'Customers pay through your username or by scanning your QR code.',
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
