import { prisma } from '../lib/prisma.js';
import type { HomeDashboard, RecentTransaction } from '../types/index.js';
import { getUserTotalBalanceInFiat } from './balance.js';
import { toRecentTransaction } from './transaction-view.js';
import { getFiatPerUsd, resolveUserFiat } from './payments.js';

/**
 * What an activity row calls a transfer with no merchant behind it.
 *
 * A raw 42-character address overflows the row and gives its avatar letter "0",
 * which says nothing — so the address is shortened for prose, the same 6+4 shape
 * the send panel shows. The full address stays on the row itself, which is where
 * anyone checking a transfer will look anyway.
 *
 * `description` wins when the caller supplied one: a send can carry a note, and
 * a note is a better row title than any address.
 */

/**
 * Aggregate the user's home dashboard.
 *
 * The live wallet balance is read from the Tempo chain and reconciled with
 * the local ledger. The local transaction list is used for the recent activity
 * feed and spending trend calculations.
 */
export async function getHomeDashboard(userId: string): Promise<HomeDashboard> {
  const wallet = await prisma.wallet.findFirst({
    where: { userId, status: 'active' },
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { merchant: true, wallet: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // The live rate, from the same quote the payment preview uses, so the
  // dashboard total and the pay screen cannot report different KES figures for
  // the same balances.
  const fiatCurrency = await resolveUserFiat(userId);
  const balance = wallet
    ? await getUserTotalBalanceInFiat(userId, await getFiatPerUsd(fiatCurrency))
    : '0.00';

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = transactions.filter(
    (t) => t.status === 'completed' && t.createdAt >= startOfMonth
  );
  const lastMonthAmount = 0; // placeholder until computed
  const thisMonthAmount = thisMonth.reduce(
    (sum, t) => sum + (t.type === 'payment' || t.type === 'p2p_send' ? Number(t.amount) : 0),
    0
  );
  const monthToDateDelta = lastMonthAmount === 0 ? 0 : (thisMonthAmount - lastMonthAmount) / lastMonthAmount;

  /**
   * Rows come from the shared view mapper, so the card and the full Activity
   * screen name a transfer identically.
   */
  const recentTransactions: RecentTransaction[] = transactions
    .slice(0, 10)
    .map((row) => toRecentTransaction(row));

  return {
    balance,
    currency: fiatCurrency,
    monthToDateDelta,
    recentTransactions,
  };
}
