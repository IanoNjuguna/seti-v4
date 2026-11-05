import type { FormEvent } from 'react';
import type { ConvertQuote } from '@/lib/api/convert';

/**
 * One figure the page says, and how it should read.
 *
 * The tone is a decision the hook makes, not a colour a component picks: a sentence that
 * says nothing moved is an alert, and a sentence that says where things stand is not.
 */
export type SwapLineTone = 'muted' | 'alert';

export interface SwapStateLineModel {
  tone: SwapLineTone;
  sentence: string;
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

export interface SwapAmountFieldProps {
  id: string;
  amount: string;
  /** The field's own message, when the figure cannot be asked about. */
  error: string | null;
  /**
   * What this balance can actually swap, in its own units: the server's `max` resolution,
   * gas already subtracted (#337). Null while that quote is in flight or was refused, and
   * the ceiling is simply absent rather than guessed from the balance row.
   */
  spendable: string | null;
  /** The symbol `spendable` is in, for the caption beside `All`. */
  symbol: string;
  busy: boolean;
  /**
   * Take the cursor. Set when the refusal in the state line is one that tells the
   * customer to try a smaller amount: the field is where that is done.
   */
  refocus: boolean;
  onAmount: (value: string) => void;
  onAll: () => void;
}

export interface SwapFiguresProps {
  /** The server's quote for the amount on screen. Every figure below is its own. */
  quote: ConvertQuote;
}

/** The pair's rate, printed between the pickers and the amount (#337). */
export interface SwapRateLineProps {
  quote: ConvertQuote;
}

export interface SwapStateLineProps {
  tone: SwapLineTone;
  sentence: string;
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
