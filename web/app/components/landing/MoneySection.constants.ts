import type { ByAudience } from './Audience.types';
import type { MoneySectionCopy } from './MoneySection.types';

/**
 * What the dollars are for, as four squares per reader.
 *
 * THE BAND'S SHAPE IS THE REFERENCE'S card grid, which is the one section shape
 * this page did not have: four square objects on the band, 20px apart, each
 * carrying one thing, with the band's heading above them. On cash.app the four
 * squares are a big figure, a photograph and a floating UI chip; here they are
 * four things you can do with a balance, because that is what this product
 * actually has and a picture of a card would be a picture of something Seti does
 * not issue.
 *
 * THE LABEL SITS INSIDE THE SQUARE AND THE SENTENCE AT ITS FOOT, where the
 * reference puts the sentence OUTSIDE the card and under it. It moved inside
 * because the object in these squares is a word rather than an image: a caption
 * repeating the word above it is the same fact twice.
 *
 * FOUR IS THE REFERENCE'S COUNT and it is also the count the two audiences have:
 * each gets the two things it does (pay and send, or be paid by name and be paid
 * by code), the thing it gets for free (being paid by name, or owning the money
 * outright), and holding dollars, which is true of both and is where the band
 * stops making a claim about a currency it cannot convert.
 *
 * NOTHING HERE NAMES A CARD, A BANK, M-PESA OR AN OFF-RAMP, because none of them
 * exist in v1. "Hold dollars" says what happens to a balance and promises no way
 * out of it.
 */
export const MONEY_COPY: ByAudience<MoneySectionCopy> = {
  personal: {
    title: 'Spend it, or send it.',
    tiles: [
      {
        label: 'Pay in a shop',
        detail: 'Scan the code, or type the shop name.',
      },
      {
        label: 'Send to a person',
        detail: 'A name, or a link. No long numbers to copy.',
      },
      {
        label: 'Get paid',
        detail: 'Your own name and link work the same way round.',
      },
      {
        label: 'Hold dollars',
        detail: 'Your balance stays in dollars until you spend it.',
      },
    ],
  },

  business: {
    title: 'Spend it, or send it.',
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
  },
};
