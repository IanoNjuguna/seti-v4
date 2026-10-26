import { prisma } from '../lib/prisma.js';
import type { HomeDashboard, RecentTransaction } from '../types/index.js';
import { getUserAssetBalances, homeBalanceInFiat } from './balance.js';
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
 *
 * The payload carries what the balance is MADE OF — one row per asset the network
 * lists, each with its own amount and its own value — because what is displayed is
 * what is spendable, and a wallet-style home cannot be built on a single figure: a
 * customer had no way to learn which stablecoin their money arrived in.
 */
export async function getHomeDashboard(
  userId: string,
  network: Network = servedNetwork
): Promise<HomeDashboard> {
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
   * ONE read, one answer. The rows and the total are produced together by
   * `homeBalanceInFiat`, and the total is the sum of exactly those rows — the figure
   * on the card cannot disagree with the breakdown under it, because there is only
   * one conversion and it is applied to the rows the customer sees. Two reads would
   * be two chances to quote different money for the same moment, and one read that
   * summed the amounts independently could round to a different cent than the rows.
   *
   * The read runs whether or not a wallet row exists. `getUserBalance` answers 0.00
   * per asset when there is no address to ask, so a brand-new account still gets one
   * row per asset the CHAIN lists, and the row count is a property of the network
   * rather than of this customer. That guard used to sit here, asking the database
   * "does this user have a wallet" so the payload could shrink to an empty list —
   * which is the same failure from the other end as a too-narrow read: the money (or
   * its absence) described by something other than the network's asset list.
   *
   * Scoped by the session's network: the home card is one network's money. A
   * practice balance and a live balance are different numbers on different chains.
   */
  const rows = await getUserAssetBalances(userId, network);
  const { assets, balance } = homeBalanceInFiat(rows, await getFiatPerUsd(fiatCurrency));

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
