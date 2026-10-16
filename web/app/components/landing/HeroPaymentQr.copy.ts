import { HERO_MERCHANT_NAME } from './HeroPaymentQr.constants';

/**
 * Every word that renders beside the code.
 *
 * No imperative and no "send-to-this-address": the code opens a PAYMENT PAGE for
 * a named merchant, a different thing from a wallet address to push funds at. The
 * page learned that once — a scan-to-pay code sits badly under a label that does
 * not say what it is — which is why the treasury address that used to be
 * published in the footer was taken off the page rather than given a code.
 *
 * THE MIDDLE SENTENCE IS GONE, BY THE OWNER'S CALL, and no string here remains
 * unrendered. The caption used to be two lines: `lead`, then a network sentence
 * that read "ianllc accepts payments on Seti. You scan the QR code or use the link
 * below to send them money." — a sentence describing a plate the reader can see
 * above it and a URL they can see below it. Both strings are deleted rather than
 * kept dark, because the half renders ONE sentence now and a string sitting in
 * this file is a claim the page makes. `IS_PRACTICE_NETWORK` went with them: its
 * whole job was choosing between the two, and what that costs is recorded in
 * `HeroPaymentQr.constants.ts`.
 *
 * THE HANDLE IS BARE. These sentences used to print `@ianllc`; the `@` is now
 * gone from every hero string, because the app writes a handle plain everywhere
 * it stores one, the URL this very code encodes is `/m/ianllc`, and a name with
 * an `@` in front of it was the hero's own second spelling of it. The payload is
 * NOT changed to match the caption; the URL has to keep resolving.
 *
 * `lead` is the owner's exact string, applied literally — the capital `I`, no
 * trailing full stop. It is a literal rather than an interpolation so nothing can
 * "tidy" it; the capital follows the merchant's NAME (`Ianllc`), while the handle
 * the app stores and renders everywhere else is lowercase (`ianllc` — the stored
 * handle is rendered verbatim, no casing applied).
 */
export const HERO_QR_COPY = {
  /** The code's accessible name; also the SVG's own `<title>`. */
  title: `Payment link for ${HERO_MERCHANT_NAME} — opens their Seti payment page`,
  lead: 'Scanning this opens a real payment to ianllc',
  /**
   * The warning, and the last line under the code: the one sentence on the page
   * that stops a visitor paying a demonstration merchant. The owner's wording
   * verbatim, right down to the capitalised `DO NOT` — that emphasis is his, not a
   * typo to be tidied. It carries no `Disclaimer:` label, because a label that
   * repeats what the sentence already says is the same fact twice.
   */
  disclaimer: 'ianllc is shown for demonstration. DO NOT send money to this address.',
} as const;
