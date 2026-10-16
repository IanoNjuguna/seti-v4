/**
 * The hero's words: one promise, the way in, and the two actions.
 *
 * They live in one file because they are read top to bottom as one block, and
 * `HeroCopy` is the only thing that renders them. The QR's own words — including
 * the demonstration warning, which sits under the merchant link in the other half
 * — are the code's (`HeroPaymentQr.copy.ts`), not the hero copy block's: the
 * warning belongs to the thing it is about, and this is the half without a link.
 *
 * The handle is written bare — `ianllc`, no `@` — the way the app stores it and
 * the way the URL under the code spells it. The hero used to print `@ianllc`; the
 * `@` was a second way of writing a name the rest of the app writes plain.
 */
export const HERO_COPY = {
  /**
   * The promise, and deliberately currency-free: nothing above the fold names
   * the money. The first figure on the page is the next band's.
   */
  headline: 'Get paid.',
  /**
   * The way in, in the owner's wording. NOTE THE AUDIENCE SHIFT, which is his and
   * not a defect to tidy: the headline above this line speaks to the merchant
   * ("Get paid."), this line speaks to the customer ("Use Seti to send and receive
   * money."), and the QR half's line speaks about the merchant in the third person
   * ("ianllc accepts payments on Seti."). Three voices in one band, by his call.
   */
  lede: 'Use Seti to send and receive money.',
  /** The two ways in. A CTA is 2 to 4 words. */
  primaryAction: 'Open Seti',
  secondaryAction: 'See how it works',
} as const;
