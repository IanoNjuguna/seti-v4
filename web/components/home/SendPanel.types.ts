import type { EmbeddedWalletStatus } from '@/hooks/useEmbeddedWallet.types';
import type { SendPreview } from '@/lib/api';

/** Only `previewing`, `signing` and `recording` are busy. A receipt is `sent`. */
export type SendStep = 'idle' | 'previewing' | 'signing' | 'recording';

/** The receipt for the one transfer that was signed and broadcast. */
export interface SentTransfer {
  txHash: string;
  /** The principal, in the customer's currency, exactly as quoted and signed. */
  amountFiat: string;
  /** The fee that was collected, in the customer's currency. */
  feeFiat: string;
  /** The currency both figures are in — stated, never assumed by the receipt. */
  fiatCurrency: string;
  recipient: string;
}

export interface SendPanelState {
  step: SendStep;
  recipient: string;
  /** The customer's currency — the same unit the pay screen takes, so both read alike. */
  amountFiat: string;
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

export interface SendFeeSummaryProps {
  preview: SendPreview | null;
  loading: boolean;
}

export interface SendFormProps {
  /** The amount field's label, with the customer's currency in it. */
  amountLabel: string;
  recipient: string;
  amountFiat: string;
  recipientError: string | null;
  amountError: string | null;
  formError: string | null;
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
