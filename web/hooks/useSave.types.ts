import type { SavingsDepositQuote, SavingsSummary } from '@/lib/api/savings';

/** What the Save screen is doing right now. */
export type SaveStatus = 'idle' | 'submitting';

export interface UseSaveReturn {
  summary: SavingsSummary | null;
  loading: boolean;
  amountFiat: string;
  quote: SavingsDepositQuote | null;
  status: SaveStatus;
  /** A sentence for the page, or null. */
  error: string | null;
  /** Set once a deposit has landed, so the page can say so. */
  deposited: { fiatAmount: string; shares: string } | null;
  canSubmit: boolean;
  setAmount: (amount: string) => void;
  submit: () => void;
  dismiss: () => void;
}

export interface SaveFigureProps {
  summary: SavingsSummary | null;
  loading: boolean;
}

export interface SaveAmountProps {
  currency: string;
  amount: string;
  quote: SavingsDepositQuote | null;
  status: SaveStatus;
  error: string | null;
  canSubmit: boolean;
  spendableFiat: string;
  onAmount: (amount: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export interface SaveActionsProps {
  canWithdraw: boolean;
  onAdd: () => void;
}
