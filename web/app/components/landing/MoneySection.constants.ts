import type { MoneySectionCopy } from './MoneySection.types';

/**
 * What the dollars are for, as squares.
 *
 * THE DISPLAY HEADING IS GONE (#288). It read "Paid to you, held by you.", added for
 * #276 as the same idea the tiles carry — money arriving in the merchant's own balance
 * and staying there — said in one line above four tiles that say it in four parts. The
 * owner deleted it along with the two other bands' headings, because a heading that
 * restates the marker and the content is a line the page pays for and nobody reads. The
 * marker ("Your money") is the band's heading now, so the outline still has one, and the
 * band opens straight into the squares.
 *
 * THE BAND'S SHAPE IS THE REFERENCE'S card grid, which is the one section shape
 * this page did not have: four tiles on the band, 20px apart, each carrying one
 * thing. On cash.app those four are a big figure, a photograph and a floating UI
 * chip inside square frames; here they are
 * four things you can do with a balance, in frames that are wider than they are tall
 * because words are not a photograph, because that is what this product actually
 * has and a picture of a card would be a picture of something Seti does not issue.
 *
 * THE LABEL SITS INSIDE THE SQUARE AND THE SENTENCE AT ITS FOOT, where the
 * reference puts the sentence OUTSIDE the card and under it. It moved inside
 * because the object in these squares is a word rather than an image: a caption
 * repeating the word above it is the same fact twice.
 *
 * FOUR BECAME THREE (#286). The fourth tile was "The money is yours. It lands in
 * your own balance. Nobody holds it in between.", which is not a fourth thing a
 * merchant does with a balance: it is the hero's own claim ("The money lands in your
 * own wallet. Seti never holds it.") said again, and the heading above it ("Paid to
 * you, held by you.") said a third time. The three that remain are verbs the reader
 * can act on. A band of restatements teaches a scanning reader that the rest of it
 * is skippable too, and the claim it repeated is above the fold where it matters.
 *
 * THE GRID DROPS TO THREE COLUMNS with it (`MoneySection.tsx`): three tiles in a
 * four-column grid leave a hole at the right edge, and a hole is worse than the
 * sentence was.
 *
 * NOTHING HERE NAMES A CARD, A BANK, M-PESA OR AN OFF-RAMP, because none of them
 * exist in v1. "Hold dollars" says what happens to a balance and promises no way
 * out of it.
 */
export const MONEY_COPY: MoneySectionCopy = {
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
      label: 'Hold dollars',
      detail: 'Your balance stays in dollars between payments.',
    },
  ],
};
