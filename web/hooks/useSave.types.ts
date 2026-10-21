import type {
  SavingsDepositQuote,
  SavingsSummary,
  SavingsWithdrawQuote,
} from '@/lib/api/savings';

/** What the Save screen is doing right now. */
export type SaveStatus = 'idle' | 'submitting';

/** Which way money is moving, or null when no sheet is open. */
export type SaveMode = 'add' | 'withdraw' | null;

export interface UseSaveReturn {
  summary: SavingsSummary | null;
  loading: boolean;
  /** `add` or `withdraw` while an amount sheet is open; null when the page is idle. */
  mode: SaveMode;
  amountFiat: string;
  /** Whichever quote the open sheet priced: a deposit's or a withdrawal's. */
  quote: SavingsDepositQuote | SavingsWithdrawQuote | null;
  status: SaveStatus;
  /** A sentence for the page, or null. */
  error: string | null;
  /** Set once money has moved, so the page can say which way. */
  done: { mode: 'add' | 'withdraw'; fiatAmount: string } | null;
  canSubmit: boolean;
  setMode: (mode: SaveMode) => void;
  setAmount: (amount: string) => void;
  submit: () => void;
  /** Close the sheet and forget the amount — used by Cancel and after a success. */
  reset: () => void;
  dismiss: () => void;
}

export interface SaveFigureProps {
  summary: SavingsSummary | null;
  loading: boolean;
}

export interface SaveAmountProps {
  mode: 'add' | 'withdraw';
  currency: string;
  amount: string;
  quote: SavingsDepositQuote | SavingsWithdrawQuote | null;
  status: SaveStatus;
  error: string | null;
  canSubmit: boolean;
  spendableFiat: string;
  savedFiat: string;
  onAmount: (amount: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export interface SaveActionsProps {
  canWithdraw: boolean;
  /** Why withdraw is unavailable, when it is. */
  withdrawReason: string | null;
  onAdd: () => void;
  onWithdraw: () => void;
}
