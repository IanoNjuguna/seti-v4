/**
 * The code's accessible name, and the only word anywhere about what the picture is.
 *
 * "SCAN TO PAY" (#288), which is what the object does in one clause, verb first. It was
 * `Scan to open Ianllc's Seti payment page`, one clause per #274, which named the merchant
 * and the destination; the owner cut it back to the action alone, because the name was
 * being read out to a screen reader as a sentence about a merchant that the sighted reader
 * gets from the code itself.
 *
 * WHAT THAT COSTS, recorded rather than argued: a screen-reader user now hears what to do
 * with the code and not what it opens or whose page it is. A code can carry a link, an
 * address or a payment request, so the "open a page" distinction is gone from the name.
 * If it needs to come back it belongs in the sentence, not in a visible caption: a caption
 * under the symbol came and went the same day (#288), because the hero is a code and a
 * promise and the block is the code alone.
 *
 * THE HANDLE IS NOT PRINTED anywhere on the page. `ianllc` is the handle the URL carries
 * (`HeroPaymentQr.constants.ts`); nothing in the hero spells it, with or without an `@`.
 */
export const HERO_QR_COPY = {
  /** The code's accessible name; also the SVG's own `<title>`. */
  title: 'Scan to pay',
} as const;
