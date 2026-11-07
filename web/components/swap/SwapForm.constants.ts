import { SWAP_COPY } from '@/lib/pay/convert-swap.constants';
import { formatAssetUnits } from '@/components/home/home.format';

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

/**
 * The pair's rate as one line: `1 OUSD ≈ 0.999900 pathUSD` (#337).
 *
 * The figure is the quote's own `rate`, and this function only puts the two symbols
 * around it, so the rule that a sentence carries no figure still holds where it matters:
 * nothing here divides one amount by another. Every swap surface in the reference set
 * prints this line, and without it a customer sees two quantities and no price.
 */
export function swapRateLine(inSymbol: string, rate: string, outSymbol: string): string {
  return `1 ${inSymbol} ≈ ${formatAssetUnits(rate)} ${outSymbol}`;
}

/**
 * The ceiling beside `All`: what the balance can actually spend, in its own units.
 *
 * The figure is the server's `max` resolution (balance less the gas the swap costs), so
 * it is the same number `All` puts in the field. A balance row would overstate it by the
 * fee, which is why it is never read from there.
 */
export function spendableLine(units: string, symbol: string): string {
  return `up to ${formatAssetUnits(units)} ${symbol}`;
}

export const SWAP_SOURCE_FIELD_ID = 'swap-source';
export const SWAP_TARGET_FIELD_ID = 'swap-target';
export const SWAP_AMOUNT_FIELD_ID = 'swap-amount';

/**
 * The hash well's words, and only its words.
 *
 * `copied` and `copyFailed` exist because `writeToClipboard` reports both outcomes and a
 * control that says nothing after a press is a control a customer presses again. The copy
 * NEVER claims the hash was kept anywhere: it was written to the clipboard, which may be a
 * different device from the one it will be read on.
 */
export const SWAP_REFERENCE_COPY = {
  label: 'Transaction',
  copy: 'Copy hash',
  copied: 'Copied.',
  copyFailed: 'Could not copy. The hash above can be selected by hand.',
} as const;

/** The well the hash sits in: the same `surface-soft` box the send receipt uses. */
export const SWAP_REFERENCE_WELL_CLASS = 'rounded-md bg-surface-soft p-3';

/**
 * The hash itself, in full: the mono face at which hashes align, breaking anywhere rather
 * than truncating. `break-all` is the promise — a customer can select and copy it by hand
 * even where the clipboard API is blocked, which is the whole reason it is printed.
 */
export const SWAP_REFERENCE_HASH_CLASS =
  'mt-1 block break-all font-mono text-caption text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-sm';

/** The copy control, on the repo's inline-link recipe for a light canvas. */
export const SWAP_REFERENCE_COPY_CLASS =
  'mt-2 inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

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
