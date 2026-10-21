import { get, post } from './client';

/**
 * Savings, from the app.
 *
 * Three calls and one shape: read what is saved, price a deposit, record what
 * landed. Nothing here signs — the customer's own wallet does that against the
 * vault, which is why Seti can never move money out of savings without them.
 */

export interface SavingsEarnings {
  lifetime: string;
  status: 'complete' | 'incomplete_cost_basis';
  lifetimeFiat: string | null;
}

export interface SavingsSummary {
  network: string;
  available: boolean;
  status: 'ok' | 'not-offered' | 'unreadable';
  vault: {
    address: string;
    asset: string;
    sharePrice: string;
    depositsPaused: boolean;
  } | null;
  spendableFiat: string;
  fiatCurrency: string;
  savedValue: string;
  savedFiat: string;
  shares: string;
  earnings: SavingsEarnings | null;
  apy: string | null;
  canDeposit: boolean;
  canWithdraw: boolean;
}

export interface SavingsDepositQuote {
  network: string;
  fiatCurrency: string;
  fiatAmount: string;
  amountIn: string;
  assetIn: string;
  swapOut: string;
  minSwapOut: string;
  minShares: string;
  sharePrice: string;
  vault: string;
  quoteId: string;
  hasEnoughBalance: boolean;
  spendableFiat: string;
}

export async function fetchSavings(): Promise<SavingsSummary> {
  const { savings } = await get<{ savings: SavingsSummary }>('/savings');
  return savings;
}

export async function quoteSavingsDeposit(amountFiat: string): Promise<SavingsDepositQuote> {
  const { quote } = await post<{ quote: SavingsDepositQuote }>('/savings/quote', { amountFiat });
  return quote;
}

export interface RecordSavingsDepositInput {
  txHash: string;
  amountIn: string;
  depositAmount: string;
  minShares: string;
  walletAddress: string;
  quoteId?: string;
}

export async function recordSavingsDeposit(
  input: RecordSavingsDepositInput
): Promise<{ id: string; status: string }> {
  const { transaction } = await post<{ transaction: { id: string; status: string } }>(
    '/savings/deposit',
    input
  );
  return transaction;
}
