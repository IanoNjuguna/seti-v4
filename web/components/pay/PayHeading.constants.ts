/**
 * The pay screen's own words.
 *
 * The title is the PAY CARD's words ("Pay a merchant"), kept when the card was
 * deleted. The card carried a heading of its own next to the page's ("Pay
 * merchant"), and the owner dropped the page's: the card's phrasing is the one
 * that survived, as the page's `h1`, with no box and no mark around it.
 *
 * `entrySubtitle` is the owner's wording, dictated over every draft before it:
 * the card's "Type their Seti name, or scan their code. The money goes straight to
 * their wallet." became "Type their merchant name, or link." — the name a person
 * types rather than the product's own word for it, and the plain "or link" the
 * field actually accepts.
 *
 * Dropping "or scan their code" also removes a promise this surface cannot keep:
 * the web client has no camera path yet (`MerchantEntry` records why), so the old
 * line offered a scan on a screen with nothing to scan with.
 *
 * The non-custody claim is not lost from the product. It is stated, in the same
 * words, on the merchant's public page and on the person's ("The money goes
 * straight to their wallet." / "… — Seti never holds it."), which is the page a
 * customer reads BEFORE they pay; this line is the instruction on the screen where
 * they already are.
 */
export const PAY_HEADING_COPY = {
  title: 'Pay a merchant',
  entrySubtitle: 'Type their merchant name, or link.',
} as const;
