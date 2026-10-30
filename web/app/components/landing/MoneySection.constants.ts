import type { MoneySectionCopy } from './MoneySection.types';

/**
 * What the dollars are for, as four squares.
 *
 * THE HEADING NAMES WHAT THE TILES SHOW (#276). It read "Spend it, or send it.", which
 * is a payer's frame: three of the four tiles are about being paid and the fourth is
 * about holding. "Paid to you, held by you" is the same idea the tiles carry — money
 * arriving in the merchant's own balance and staying there — and it is the claim the
 * hero states once, said again where the reader can see it in four parts.
 *
 * THE BAND'S SHAPE IS THE REFERENCE'S card grid, which is the one section shape
 * this page did not have: four tiles on the band, 20px apart, each carrying one
 * thing, with the band's heading above them. On cash.app those four are a big
 * figure, a photograph and a floating UI chip inside square frames; here they are
 * four things you can do with a balance, in frames that are wider than they are tall
 * because words are not a photograph, because that is what this product actually
 * has and a picture of a card would be a picture of something Seti does not issue.
 *
 * THE LABEL SITS INSIDE THE SQUARE AND THE SENTENCE AT ITS FOOT, where the
 * reference puts the sentence OUTSIDE the card and under it. It moved inside
 * because the object in these squares is a word rather than an image: a caption
 * repeating the word above it is the same fact twice.
 *
 * FOUR IS THE REFERENCE'S COUNT and it is also the count this reading has: the two
 * things a merchant does (be paid by name, print a code), the thing it gets for free
 * (owning the money outright), and holding dollars, which is where the band stops
 * making a claim about a currency it cannot convert. The tiles used to be written
 * twice, once for a merchant and once for a person; the merchant's four are what the
 * page says now.
 *
 * NOTHING HERE NAMES A CARD, A BANK, M-PESA OR AN OFF-RAMP, because none of them
 * exist in v1. "Hold dollars" says what happens to a balance and promises no way
 * out of it.
 */
export const MONEY_COPY: MoneySectionCopy = {
  title: 'Paid to you, held by you.',
  tiles: [
    {
      label: 'Get paid by name',
      detail: 'Customers type your name instead of a number.',
    },
    {
      label: 'Print your code',
      detail: 'One code for the counter. It opens your payment page.',
    },
    {
      label: 'The money is yours',
      detail: 'It lands in your own balance. Nobody holds it in between.',
    },
    {
      label: 'Hold dollars',
      detail: 'Your balance stays in dollars between payments.',
    },
  ],
};
