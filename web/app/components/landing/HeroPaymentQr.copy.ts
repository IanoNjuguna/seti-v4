import { HERO_MERCHANT_NAME } from './HeroPaymentQr.constants';

/**
 * The code's accessible name, and the only word left in the hero about what it is.
 *
 * IT IS NOT VISIBLE COPY, and that is the point: the owner cut the three lines that
 * used to render under the code — "Scanning this opens a real payment to ianllc", the
 * printed URL, and the "DO NOT send money" warning — because the hero is a code and a
 * promise, and small print under the object competes with both. What a sighted reader
 * gets in place of those lines is the picture itself; what a screen reader gets is this
 * sentence, which is the one thing about a code that cannot be seen.
 *
 * It has to say what scanning the code DOES. A code can carry a link, an address or a
 * payment request, and "QR code" tells a screen-reader user nothing about which; this
 * one opens a named merchant's payment page, which is a different thing from a wallet
 * address to push funds at.
 *
 * THE HANDLE IS NOT PRINTED ANY MORE, so the only name in this file is the merchant's
 * own, used in words rather than as a handle: `Ianllc` is how the merchant is named and
 * `ianllc` is the handle the URL carries, and neither is spelled with an `@` — the app
 * writes a handle plain everywhere it stores one.
 */
export const HERO_QR_COPY = {
  /** The code's accessible name; also the SVG's own `<title>`. */
  title: `Payment link for ${HERO_MERCHANT_NAME} — opens their Seti payment page`,
} as const;
