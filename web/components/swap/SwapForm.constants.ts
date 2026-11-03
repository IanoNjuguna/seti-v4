import { SWAP_COPY } from '@/lib/pay/convert-swap.constants';

/**
 * The swap page's words.
 *
 * Two rules hold these sentences together, and they are the same two the row keeps.
 *
 *  1. **No sentence is a figure.** Every amount on this page is the server's, printed by
 *     `SwapFigures` from the quote for the amount on screen. These are labels, states and
 *     refusals, which is why none of them contains a number.
 *  2. **A state line never claims money moved.** The sentences for a failure come from
 *     the swap hook and from `refusal.constants.ts`; what is here says what the page is
 *     doing (reading, checking) or what it has not got (a pair, a balance in that row).
 *
 * Second person, short, no exclamation, no em dash: the voice every refusal in this app
 * uses, and `check:convert-swap` holds the shared swap copy to it.
 */
export const SWAP_FORM_COPY = {
  title: 'Swap',
  lead: 'Move money from one balance into another.',

  sourceLabel: 'Swap from',
  targetLabel: 'Hold as',
  amountLabel: 'Amount',
  amountPlaceholder: '0.00',
  /** The one control that puts the whole balance in the field. */
  all: 'All',
  /** The way off a finished swap, so a second one can be priced. */
  finish: 'Done',

  /**
   * The two figures, reused from the row's confirm step rather than written a second
   * time: one swap should read the same in the card and on the page (#240).
   */
  getAtLeast: SWAP_COPY.getAtLeast,
  networkFee: SWAP_COPY.networkFee,
  confirm: SWAP_COPY.confirm,

  /** The page is reading, and then pricing. Neither is a failure. */
  readingBalances: 'Reading your balances.',
  checkingPrice: 'Checking the price.',

  /** Facts about what the book can fill, said before anything is asked about a figure. */
  nothingToHold: 'There is nothing to swap this balance into right now.',
  noBalances: 'You have no balance to swap yet. Add money first.',

  /** A read that failed. The page still stands; what it could not measure is missing. */
  pairsUnavailable: 'Seti could not load what you can swap. Try again in a moment.',
  balancesUnavailable: 'Seti could not read your balances. Try again in a moment.',

  /** The field's own messages: an entry the customer can correct, before any request. */
  amountEmpty: 'Enter an amount above zero.',
  amountInvalid: 'Enter an amount with up to six decimal places.',
  amountOverBalance: 'That is more than this balance holds. Try a smaller amount.',
} as const;

/** What a visitor with no account sees. */
export const SWAP_SIGNED_OUT_COPY = {
  title: 'Sign in to swap',
  body: 'Swapping moves money out of your own balance.',
} as const;

/** How many decimals an amount field may carry. Every supported asset is 6dp. */
export const SWAP_AMOUNT_DECIMALS = 6;

export const SWAP_SOURCE_FIELD_ID = 'swap-source';
export const SWAP_TARGET_FIELD_ID = 'swap-target';
export const SWAP_AMOUNT_FIELD_ID = 'swap-amount';

/**
 * A picker's recipe, borrowed from `text-input` in `design/revolut.md`: 56px tall,
 * `rounded-md`, the white canvas as its fill, `hairline-light` as its border and cobalt
 * as the focus border. A select and an input are the same object at the same size, which
 * is why this is the input's own recipe rather than a second one.
 */
export const SWAP_SELECT_CLASS =
  'mt-2 h-14 w-full rounded-md border border-hairline-light bg-canvas-light px-4 text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

/**
 * An inline control on the light canvas, from the repo's own inline-link recipe: a
 * `min-touch` box so the target is a finger, `text-link` for the ink (the doc's link
 * colour on a white surface), an underline on hover and the cobalt focus ring.
 */
export const SWAP_LINK_CLASS =
  'inline-flex min-touch items-center self-end rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
