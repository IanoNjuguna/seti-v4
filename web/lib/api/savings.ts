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
  /** The VAULT's own rate, rewards excluded, as a percentage string. Null when unread. */
  apy: string | null;
  /** The campaign paying on top of the vault today, or null. See `rateLines`. */
  campaign: SavingsCampaign | null;
  canDeposit: boolean;
  canWithdraw: boolean;
  /** False means saving is closed on purpose: show "coming soon", offer no deposit. */
  live: boolean;
}

/**
 * A live rewards campaign on the vault (#426).
 *
 * Both numbers are percentages, already formatted by the server, and they are NOT
 * interchangeable: `apr` is what the campaign pays, and the vault's own rate arrives as
 * `SavingsSummary.apy`. A surface that prints one as the other turns a promotion into a yield.
 */
export interface SavingsCampaign {
  apr: string;
  endsAt: string;
}

export interface SavingsDepositQuote {
  network: string;
  fiatCurrency: string;
  fiatAmount: string;
  amountIn: string;
  /** Which asset the quote chose to fund it: pathUSD needs no swap at all. */
  assetIn: 'ousd' | 'pathusd' | 'usdt0' | 'usdc.e';
  swapOut: string;
  minSwapOut: string;
  minShares: string;
  sharePrice: string;
  vault: string;
  quoteId: string;
  hasEnoughBalance: boolean;
  /** The network fee this deposit pays, in the funding asset, reserved out of the balance. */
  networkFee?: string;
  networkFeeSource?: 'estimate' | 'reserve';
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

export interface SavingsWithdrawQuote {
  network: string;
  fiatCurrency: string;
  fiatAmount: string;
  shares: string;
  assetOut: string;
  minAssets: string;
  swapOut: string;
  minSwapOut: string;
  /** What the payout is worth in the customer's currency, priced by the server. */
  fiatOut: string;
  vault: string;
  shareToken: string;
  quoteId: string;
  /** True only when the vault redeems immediately; a queued exit is not offered. */
  canWithdraw: boolean;
  /** The network fee this exit pays, in OUSD, and how it was priced (#511). */
  networkFee: string;
  networkFeeSource: 'estimate' | 'reserve';
  /** That fee in the customer's currency, so the sheet prints money. */
  networkFeeFiat: string;
  /**
   * False when the balance outside the vault cannot pay the fee. The send would be
   * rejected before the redeem ran, so the sheet must refuse the tap.
   */
  canPayFee: boolean;
  instantLiquidity: string | null;
  positionShares: string;
}

export async function quoteSavingsWithdraw(amountFiat: string): Promise<SavingsWithdrawQuote> {
  const { quote } = await post<{ quote: SavingsWithdrawQuote }>('/savings/withdraw/quote', {
    amountFiat,
  });
  return quote;
}

export interface RecordSavingsWithdrawalInput {
  txHash: string;
  /** The shares redeemed, in share units. */
  shares: string;
  /** The OUSD floor that was signed. */
  minSwapOut: string;
  walletAddress: string;
  quoteId?: string;
}

export async function recordSavingsWithdrawal(
  input: RecordSavingsWithdrawalInput
): Promise<{ id: string; status: string }> {
  const { transaction } = await post<{ transaction: { id: string; status: string } }>(
    '/savings/withdraw',
    input
  );
  return transaction;
}

export interface RecordSavingsDepositInput {
  /** Which asset funded the deposit — the quote's choice, not ours. */
  assetIn?: 'ousd' | 'pathusd' | 'usdt0' | 'usdc.e';
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

/** One wallet's Merkl position in the campaign that pays the vault's rate (#322). */
export interface SavingsRewards {
  claimable: boolean;
  wrapper: string;
  distributor: string | null;
  /** Cumulative campaign amount for this wallet, in token units. */
  amount: string;
  /** Already paid out by the Distributor. */
  claimed: string;
  /** `amount - claimed`, pending excluded: what the claim signs. */
  claimableAmount: string;
  /** The customer's own currency, the unit of `claimableFiat`. */
  fiatCurrency: string;
  /** The claimable figure in that currency, to the minor unit. Display only. */
  claimableFiat: string;
  proofs: string[];
  /** The campaign's published end, so copy names a date instead of a bare rate. */
  campaignEnds: string;
  reason: string | null;
}

export async function fetchSavingsRewards(): Promise<SavingsRewards> {
  const { rewards } = await get<{ rewards: SavingsRewards }>('/savings/rewards');
  return rewards;
}
