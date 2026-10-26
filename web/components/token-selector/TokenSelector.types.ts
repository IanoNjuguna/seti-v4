/**
 * One balance the customer could pay from: the token's registry symbol, and what
 * that token holds in the customer's own currency.
 *
 * `asset` is the ledger label — what `PaymentPreview.asset` carries and what a
 * quote is pinned with — and `symbol` is the registry's spelling. Neither is ever
 * written in this app's source: they are read from the balance rows, so a token
 * name on screen is a FACT about a balance rather than a string someone typed.
 */
export interface TokenOption {
  asset: string;
  symbol: string;
  /** What this row holds, already formatted in the customer's currency. */
  held: string;
}

/**
 * #223's refusal, once it is actionable: the sentence the code owns, plus the one
 * token that can pay. `offer` is null when no single balance covers the amount —
 * then the sentence stands alone, because there is nothing to switch to.
 */
export interface TokenRefusal {
  /** Read from `refusalMessageFor('no-single-asset-covers')`. Never re-written here. */
  sentence: string;
  offer: TokenOption | null;
}

/** Everything the selector draws, decided in `token-selector.model.ts`. */
export interface TokenSelectorModel {
  /** Every FUNDED balance, in the order the server reads them. */
  options: TokenOption[];
  /** The token the current price spends, or the customer's pin before a price exists. */
  paying: TokenOption | null;
  /** The customer's own pin, or null while the server chooses the row that covers. */
  pinned: string | null;
  /** More than one funded balance, so there is a choice to make at all. */
  choosable: boolean;
  /** True while the balances are still being read. */
  loading: boolean;
  /** The read failed. Said in words rather than silently drawing nothing. */
  unavailable: boolean;
  /** Set only for a PINNED token that cannot cover while another can. */
  refusal: TokenRefusal | null;
}

export interface TokenSelectorProps {
  model: TokenSelectorModel;
  /** Pin a token. Null returns the choice to the server. */
  onChoose: (asset: string | null) => void;
}

/** What the selector's own controls need: whether the list is open, and how to act. */
export interface UseTokenSelectorReturn {
  open: boolean;
  toggle: () => void;
  choose: (asset: string) => void;
}
