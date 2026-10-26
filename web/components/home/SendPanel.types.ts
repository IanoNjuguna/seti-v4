import type { EmbeddedWalletStatus } from '@/hooks/useEmbeddedWallet.types';
import type { HandleIdentity, SendPreview } from '@/lib/api';
import type { SupportedAsset } from '@/lib/chain';
import type { TokenSelectorModel } from '@/components/token-selector/TokenSelector.types';

export interface SendPanelProps {
  /**
   * A recipient handed in by the URL — a `seti.live/u/<handle>` page's Send
   * action sends `/app/send?to=<handle>`. It is the same string a typed handle
   * would be, resolved through the same path, so the panel shows a name AND an
   * address before anything is signed.
   */
  initialRecipient?: string;
  /**
   * Whether the amount field should take focus as the step mounts (#99).
   *
   * True when the payee arrived known: a link that named them, or a tap on someone
   * this account has paid before. The payee is the answered question, so the cursor
   * belongs in the amount field. It says nothing about the amount's VALUE: the field
   * is empty until the customer types, on every route into this step.
   */
  focusAmount?: boolean;
}

/** Only `previewing`, `signing` and `recording` are busy. A receipt is `sent`. */
export type SendStep = 'idle' | 'previewing' | 'signing' | 'recording';

/**
 * The server's answer for what was typed, kept WITH the string it was asked
 * about. A slow response for a username the customer has since edited is dropped
 * rather than shown as a confident identity for the wrong person.
 */
export interface ResolvedRecipient {
  query: string;
  identity: HandleIdentity;
}

/** The receipt for the one transfer that was signed and broadcast. */
export interface SentTransfer {
  txHash: string;
  /** The principal, in the customer's currency, exactly as quoted and signed. */
  amountFiat: string;
  /** The fee that was collected, in the customer's currency. */
  feeFiat: string;
  /** Principal + fee + gas, in the customer's currency. What left the wallet. */
  totalFiat: string;
  /** The gas the sender funded, in the customer's currency. */
  networkFeeFiat: string;
  /** `true` when the gas was measured at the live price, not held as a reserve. */
  gasEstimated: boolean;
  /** The currency both figures are in — stated, never assumed by the receipt. */
  fiatCurrency: string;
  recipient: string;
}

export interface SendPanelState {
  step: SendStep;
  /** The address the customer typed, OR a username to be resolved. */
  recipient: string;
  /** The customer's currency — the same unit the pay screen takes, so both read alike. */
  amountFiat: string;
  /**
   * The balance the customer chose to spend from (#232), or null while the server
   * chooses the row that covers.
   *
   * A pin, not a preference: it rides on every quote, so the amount priced, the fee
   * line and the recorded asset are all for the token they picked. A pin that cannot
   * cover is REFUSED by the server (#223) rather than quietly swapped, which is what
   * makes letting a person choose safe at all.
   */
  asset: SupportedAsset | null;
  /** The last resolution the server returned, tagged with what it was for. */
  resolution: ResolvedRecipient | null;
  /** The server's quote. Both signed amounts come from here, not from the fields. */
  preview: SendPreview | null;
  /**
   * The token the server said WOULD cover this amount, after a refused pin (#223).
   *
   * Read, never worked out: the unpinned quote answers with the row the server
   * would spend. Null when no single balance covers, and then there is no offer to
   * make and #223's sentence stands alone.
   */
  coverOffer: SupportedAsset | null;
  /**
   * Field errors are kept apart from `formError` because only these two are the
   * customer's entry. A wallet, chain or server failure is not an amount problem,
   * and putting it on the field blames the wrong thing — the pay screen routes
   * the same way for the same reason.
   */
  recipientError: string | null;
  amountError: string | null;
  formError: string | null;
  /** The refusal code behind `formError`, so a sentence is never drawn twice. */
  formErrorCode: string | null;
  sent: SentTransfer | null;
}

export interface UseSendPanelReturn extends SendPanelState {
  /**
   * The resolved identity for what is CURRENTLY typed, or null.
   *
   * This is the name AND the address the customer is shown before anything is
   * signed: the username is only how they found the person, and the address is
   * what gets signed. It is null while a typed value is an address (there is no
   * name to show) or while a username has not resolved yet.
   */
  resolved: HandleIdentity | null;
  /** Whether an embedded wallet exists yet, so the panel can say so first. */
  walletStatus: EmbeddedWalletStatus;
  isBusy: boolean;
  /** True while the debounced quote for what is typed is still in flight. */
  previewLoading: boolean;
  /**
   * Which balance pays, derived once from the quote and the commit (#232) — the
   * SAME model the pay step mounts, so the two flows cannot answer differently.
   */
  tokenSelector: TokenSelectorModel;
  setRecipient: (value: string) => void;
  setAmountKes: (value: string) => void;
  /** Pin a balance, or null to hand the choice back to the server. */
  setAsset: (asset: string | null) => void;
  submit: () => void;
  reset: () => void;
}

export interface SendFieldProps {
  label: string;
  hint: string;
  error: string | null;
  value: string;
  onChange: (value: string) => void;
  inputMode?: 'text' | 'decimal';
  /** Addresses read as code: monospace, no autocorrect, no autocapitalise. */
  mono?: boolean;
  disabled: boolean;
  /**
   * Takes focus on mount. Only the amount field uses it, and only when the payee is
   * already known (#99): the field it asks about is the only one left to fill.
   */
  autoFocus?: boolean;
}

/** The resolved name and address, shown before anything is signed. */
export interface SendResolvedRecipientProps {
  recipient: HandleIdentity;
}

export interface SendFormProps {
  /** The amount field's label, with the customer's currency in it. */
  amountLabel: string;
  recipient: string;
  amountFiat: string;
  recipientError: string | null;
  amountError: string | null;
  formError: string | null;
  /** The refusal code behind `formError`. `sendFormFlags` is what decides its fate. */
  formErrorCode: string | null;
  /** The resolved identity, when the typed recipient is a username. */
  resolved: HandleIdentity | null;
  /** Which balance pays (#232): the model the pay step mounts, from the same helper. */
  tokenSelector: TokenSelectorModel;
  preview: SendPreview | null;
  previewLoading: boolean;
  /** The step, so the submit row can narrate what is being waited on. */
  step: SendStep;
  busy: boolean;
  /** The payee arrived known, so the amount field takes focus (#99). */
  focusAmount: boolean;
  onRecipientChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  /** Pin a balance, or null to hand the choice back to the server. */
  onChooseAsset: (asset: string | null) => void;
  onSubmit: () => void;
}

/**
 * The amount, the balance it comes from, and the price of that answer — in that
 * order, which is the order the customer answers them (#232).
 */
export interface SendAmountSectionProps {
  /** The amount field's label, with the customer's currency in it. */
  amountLabel: string;
  amountFiat: string;
  amountError: string | null;
  preview: SendPreview | null;
  previewLoading: boolean;
  tokenSelector: TokenSelectorModel;
  busy: boolean;
  focusAmount: boolean;
  onAmountChange: (value: string) => void;
  onChooseAsset: (asset: string | null) => void;
}

/**
 * What the FORM itself still has to say, after the screen's other surfaces have
 * said what is theirs. One pure function, so the rule is testable without a render.
 */
export interface SendFormFlags {
  /** The line the form draws, or null when nothing is left for it to say. */
  formError: string | null;
}

export interface SendSubmitProps {
  step: SendStep;
}

export interface SendResultProps {
  sent: SentTransfer;
  onReset: () => void;
}
