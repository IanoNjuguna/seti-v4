import { prisma } from '../lib/prisma.js';
import type { HomeDashboard, RecentTransaction } from '../types/index.js';
import { getUserAssetBalances, sumBalancesInFiat } from './balance.js';
import { toRecentTransaction } from './transaction-view.js';
import { getFiatPerUsd, resolveUserFiat } from './payments.js';
import { servedNetwork } from '../config/networks.js';
import type { Network } from '../lib/network.js';

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
export async function getHomeDashboard(
  userId: string,
  network: Network = servedNetwork
): Promise<HomeDashboard> {
  // Scoped by the session's network: the home card is one network's money. A
  // practice balance and a live balance are different numbers on different chains.
  const wallet = await prisma.wallet.findFirst({
    where: { userId, status: 'active', network },
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId, network },
    include: { merchant: true, wallet: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // The live rate, from the same quote the payment preview uses, so the
  // dashboard total and the pay screen cannot report different KES figures for
  // the same balances.
  const fiatCurrency = await resolveUserFiat(userId);

  /**
   * ONE read, two answers. The total and the breakdown are computed from the same
   * asset rows rather than read twice, so the figure on the card can never disagree
   * with the rows the breakdown shows for the same moment. It is also one set of RPC
   * calls instead of two.
   */
  const assets = wallet ? await getUserAssetBalances(userId, network) : [];
  const balance = wallet
    ? sumBalancesInFiat(
        assets.map((row) => ({ asset: row.asset, balance: row.amount })),
        await getFiatPerUsd(fiatCurrency)
      )
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
    assets,
    monthToDateDelta,
    recentTransactions,
  };
}
