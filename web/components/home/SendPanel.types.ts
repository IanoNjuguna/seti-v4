import type { EmbeddedWalletStatus } from '@/hooks/useEmbeddedWallet.types';
import type { HandleIdentity, SendPreview } from '@/lib/api';

export interface SendPanelProps {
  /**
   * A recipient handed in by the URL — a `seti.live/u/<handle>` page's Send
   * action sends `/app/send?to=<handle>`. It is the same string a typed handle
   * would be, resolved through the same path, so the panel shows a name AND an
   * address before anything is signed.
   */
  initialRecipient?: string;
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
  /** The last resolution the server returned, tagged with what it was for. */
  resolution: ResolvedRecipient | null;
  /** The server's quote. Both signed amounts come from here, not from the fields. */
  preview: SendPreview | null;
  /**
   * Field errors are kept apart from `formError` because only these two are the
   * customer's entry. A wallet, chain or server failure is not an amount problem,
   * and putting it on the field blames the wrong thing — the pay screen routes
   * the same way for the same reason.
   */
  recipientError: string | null;
  amountError: string | null;
  formError: string | null;
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
  setRecipient: (value: string) => void;
  setAmountKes: (value: string) => void;
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
  /** The resolved identity, when the typed recipient is a username. */
  resolved: HandleIdentity | null;
  preview: SendPreview | null;
  previewLoading: boolean;
  /** The step, so the submit row can narrate what is being waited on. */
  step: SendStep;
  busy: boolean;
  onRecipientChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onSubmit: () => void;
}

export interface SendSubmitProps {
  step: SendStep;
}

export interface SendResultProps {
  sent: SentTransfer;
  onReset: () => void;
}
