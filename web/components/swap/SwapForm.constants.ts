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

  /**
   * The two sides of the pair (#417). `You pay` / `You get` rather than `Swap from` /
   * `Hold as`: the first is a sentence a customer says, and `Hold as` was a phrase no one
   * uses for the token they end up with.
   */
  payLabel: 'You pay',
  getLabel: 'You get',

  /** The amount's own name, for a screen reader: the card's caption is the visible label. */
  amountAria: 'Amount to pay',

  /** The row under the pay figure: what is held, and the control that fills the field. */
  balanceLabel: 'Balance',
  max: 'Max',

  /** The flip control between the cards, as a button name. */
  flipLabel: 'Swap the two sides',

  amountPlaceholder: '0.00',
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
 * The pair, as ONE panel with two zones and a divider (#417, #421).
 *
 * Two cards sitting flush was the wrong shape: each carried its own hairline and its own
 * `rounded-md` corners, so the seam was two borders back to back with two sets of corners,
 * a pinched waist behind the flip control rather than a division. `design/revolut.md` has
 * one panel shape, the one `SaveFlow` and `feature-card-light` use: a surface with an
 * internal `hairline-light` rule. So the frame is on the panel and the zones are zones.
 */
export const SWAP_PANEL_CLASS = 'rounded-md border border-hairline-light bg-canvas-light';

/** A zone's own padding. The seam's clearance belongs to the wrappers in `SwapFields`. */
export const SWAP_CARD_CLASS = 'px-4 py-3';

/**
 * The figure, at the size a figure is read at.
 *
 * ONE size class, deliberately: `Text`'s `balance` variant steps 24px to 40px at `sm`, and
 * this column is the same width at every breakpoint, so the larger step would overflow a
 * six-decimal amount. A single class also cannot lose to a second one by emission order.
 * Mono and tabular because a figure is what mono is for.
 */
export const SWAP_FIGURE_CLASS =
  'block w-full min-w-0 bg-transparent p-0 text-right font-mono font-tabular font-medium text-heading-md text-ink outline-none disabled:opacity-60';

/**
 * The token control: `surface-soft`, a hairline, and the doc's own radius.
 *
 * It was `rounded-full` for one commit (#417), which the radius scale forbids: "`{rounded.full}`
 * means a circle and nothing else", and "no button, card or input is a pill". The control is
 * 12px like every other surface and control in the app, so it reads as the same object as the
 * panel it sits in (#421).
 */
export const SWAP_PILL_CLASS =
  'min-touch appearance-none rounded-md border border-hairline-light bg-surface-soft pl-10 pr-8 text-body-md-bold text-ink outline-none transition-colors hover:bg-canvas-light focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

/** The row under a card's figure: quiet ink, one line, the same height either side. */
export const SWAP_CARD_FOOTER_CLASS =
  'mt-2 flex items-baseline justify-between gap-3 border-t border-hairline-light pt-2';

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
 * An inline control on the light canvas, from the repo's own inline-link recipe: a
 * `min-touch` box so the target is a finger, `text-link` for the ink (the doc's link
 * colour on a white surface), an underline on hover and the cobalt focus ring.
 *
 * `self-end` is gone: this control now sits in a card's footer row beside the balance,
 * where the row's own `justify-between` places it, not at the end of a column (#417).
 */
export const SWAP_LINK_CLASS =
  'inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:text-stone disabled:no-underline';
