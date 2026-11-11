import type { FormEvent, KeyboardEvent, ReactNode, RefObject } from 'react';
import type { ConvertQuote } from '@/lib/api/convert';
import type { Network } from '@/lib/network';

/**
 * One figure the page says, and how it should read.
 *
 * The tone is a decision the hook makes, not a colour a component picks: a sentence that
 * says nothing moved is an alert, and a sentence that says where things stand is not.
 */
export type SwapLineTone = 'muted' | 'alert';

/**
 * The hash a state line asks the customer to keep, and the network it happened on.
 *
 * It exists because ONE sentence on this page tells a customer to keep a reference, and a
 * reference the page does not print is a sentence that cannot be obeyed. The network is
 * carried with it so the explorer link is the one the swap actually settled on: a practice
 * hash on the live explorer finds nothing.
 */
export interface SwapReferenceModel {
  txHash: string;
  network: Network;
}

export interface SwapStateLineModel {
  tone: SwapLineTone;
  sentence: string;
  /** Null on every line that is not asking the customer to keep something. */
  reference: SwapReferenceModel | null;
}

/**
 * One choice in a picker: the label the server names, and the words on screen.
 *
 * `asset` is the ledger's label and is what a quote is asked about. `symbol` is the
 * registry's spelling, read from the balance row, so a token name on screen is a fact
 * about a balance rather than a string typed into this app. `units` is that balance in
 * its own units, formatted exactly as the balance row prints it.
 */
export interface SwapAssetOption {
  asset: string;
  symbol: string;
  /** Empty for a target, which the customer holds an unknown amount of. */
  units: string;
  /**
   * Whether the book will fill this direction right now (#496).
   *
   * Absent on a source: a balance is payable whatever the book is doing, and the
   * question only has an answer for a swap. `false` never removes the option, it marks
   * it: an asset that vanishes from the picker reads as a bug, where "no market right
   * now" is the truth. The quote is still the thing that refuses.
   */
  live?: boolean;
}

export interface SwapSelectProps {
  /** The `id` the label points at. One per picker. */
  id: string;
  /** The picker's name, in the customer's words. */
  label: string;
  /** The asset currently chosen. */
  value: string;
  options: readonly SwapAssetOption[];
  disabled?: boolean;
  onChoose: (asset: string) => void;
}

/**
 * The token on one side, as a control (#545).
 *
 * `label` is the card's caption, and it is the trigger's ACCESSIBLE name rather than a second
 * visible label: the caption sits above the row, so the control needs no words of its own
 * besides the token's symbol. `menuTitle` names the dialog it opens, which is a different
 * sentence: what the list is for, not what the control currently holds.
 */
export interface SwapTokenControlProps {
  id: string;
  label: string;
  /** The dialog's `h2`: what choosing here decides. */
  menuTitle: string;
  value: string;
  options: readonly SwapAssetOption[];
  disabled?: boolean;
  onChoose: (asset: string) => void;
}

/** The dialog itself: one row per option, and the way out. */
export interface SwapTokenPickerProps {
  title: string;
  value: string;
  options: readonly SwapAssetOption[];
  onChoose: (asset: string) => void;
  onClose: () => void;
}

/**
 * One side of the pair: the caption, the figure, and one quiet row under them.
 *
 * `figure` is an input on the pay side and a reading on the get side, which is why it is
 * a slot rather than a string: the two look the same and behave differently, and only the
 * pay side takes a keystroke.
 */
export interface SwapCardProps {
  selectId: string;
  label: string;
  menuTitle: string;
  asset: string;
  options: readonly SwapAssetOption[];
  busy: boolean;
  onChoose: (asset: string) => void;
  figure: ReactNode;
  footer: ReactNode;
}

/** The control between the two cards, and whether the current pair can be turned over. */
export interface SwapFlipControlProps {
  disabled: boolean;
  onFlip: () => void;
}

export interface SwapAmountFieldProps {
  id: string;
  /** The accessible name: the card's caption, passed as `aria-label`. */
  label: string;
  amount: string;
  /** The field's own message, when the figure cannot be asked about. */
  error: string | null;
  busy: boolean;
  /**
   * Take the cursor. Set when the refusal in the state line is one that tells the
   * customer to try a smaller amount: the field is where that is done.
   */
  refocus: boolean;
  onAmount: (value: string) => void;
}

export interface SwapFiguresProps {
  /** The server's quote for the amount on screen. Every figure below is its own. */
  quote: ConvertQuote;
}

/** The pair's rate, printed between the pickers and the amount (#337). */
export interface SwapRateLineProps {
  quote: ConvertQuote;
}

/** The one line about where the swap stands, and the hash when there is one to keep. */
export type SwapStateLineProps = SwapStateLineModel;

/** The hash well: the reference the record-failure line tells the customer to keep. */
export interface SwapReferenceProps {
  txHash: string;
  network: Network;
}

/** The token list's open state, and the two ways it changes. */
export interface UseSwapTokenPickerReturn {
  open: boolean;
  show: () => void;
  hide: () => void;
}

/** The dialog's DOM contract: the box focus stays inside, and the Tab trap. */
export interface UseSwapTokenDialogReturn {
  containerRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** The four controls, wired to the one state object that decides them. */
export interface SwapFieldsProps {
  form: SwapFormState;
}

export interface SwapSubmitProps {
  busy: boolean;
  /** The swap is signed, mined and recorded. */
  done: boolean;
  /** Nothing can be signed yet: no quote, no pair, or no amount. */
  disabled: boolean;
  onReset: () => void;
}

/**
 * Everything `/app/swap` renders, decided in `useSwapForm`.
 *
 * The options are the customer's OWN balance rows, in the server's order, with the units
 * each already prints. The choices are assets, never figures: no amount in this object is
 * computed here, and every one of `quote`'s is the server's.
 */
export interface SwapFormState {
  /** The balances are being read. */
  loading: boolean;
  /** There is a source, a target and a form to draw. */
  ready: boolean;
  sourceOptions: SwapAssetOption[];
  targetOptions: SwapAssetOption[];
  /** The chosen source, or '' when there is nothing to choose. */
  assetIn: string;
  /** The chosen target, or '' when the book fills nothing from `assetIn`. */
  assetOut: string;
  /** What the amount field shows, which is the server's figure until the customer types. */
  amount: string;
  /** The field's own message. The state line never repeats it. */
  amountError: string | null;
  /** The server's quote for the amount on screen, or null. */
  quote: ConvertQuote | null;
  /**
   * The most this balance can swap, in its own units, from the server's `max` answer
   * (#337). Null while that request is in flight or was refused.
   */
  spendable: string | null;
  /** One sentence about where the swap stands, or null when the figures speak. */
  stateLine: SwapStateLineModel | null;
  /**
   * Whether the pair can be turned over. False when the token on the `get` side is not a
   * balance this account holds: a swap is spent FROM a balance, so flipping into one we
   * cannot spend would leave the page with no source and a figure nobody can sign.
   */
  canFlip: boolean;
  /** Turn the pair over: the get side becomes the pay side, and the amount is cleared. */
  onFlip: () => void;
  /** The amount field should take the cursor. */
  refocusAmount: boolean;
  busy: boolean;
  done: boolean;
  canSubmit: boolean;
  onSource: (asset: string) => void;
  onTarget: (asset: string) => void;
  onAmount: (value: string) => void;
  onAll: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  amountFieldId: string;
  sourceFieldId: string;
  targetFieldId: string;
}
