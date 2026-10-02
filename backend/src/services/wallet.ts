import { prisma } from '../lib/prisma.js';
import type { HomeDashboard, RecentTransaction } from '../types/index.js';

/**
 * Aggregate the user's home dashboard.
 *
 * In production, the live wallet balance should come from the Tempo chain
 * (via Privy / Tempo Accounts SDK) and be reconciled with the local ledger.
 * Here we sum completed transactions as a placeholder until on-chain reads are wired.
 */
export async function getHomeDashboard(userId: string): Promise<HomeDashboard> {
  const wallet = await prisma.wallet.findFirst({
    where: { userId, asset: 'ousd' },
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { merchant: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const completed = transactions.filter((t) => t.status === 'completed');
  const balance = completed.reduce(
    (sum, t) => sum + (t.type === 'top_up' || t.type === 'p2p_receive' ? 1 : -1) * Number(t.amount),
    0
  );

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = completed.filter((t) => t.createdAt >= startOfMonth);
  const lastMonthAmount = 0; // placeholder until computed
  const thisMonthAmount = thisMonth.reduce(
    (sum, t) => sum + (t.type === 'payment' || t.type === 'p2p_send' ? Number(t.amount) : 0),
    0
  );
  const monthToDateDelta = lastMonthAmount === 0 ? 0 : (thisMonthAmount - lastMonthAmount) / lastMonthAmount;

  const recentTransactions: RecentTransaction[] = transactions.slice(0, 10).map((t) => ({
    id: t.id,
    merchant: t.merchant?.name ?? t.counterparty ?? 'Unknown',
    category: t.merchant?.category ?? t.type,
    amount: t.amount.toString(),
    fiatAmount: t.fiatAmount?.toString() ?? null,
    fiatCurrency: t.fiatCurrency,
    date: t.createdAt,
    status: t.status,
  }));

  return {
    balance: balance.toFixed(2),
    currency: 'KES',
    monthToDateDelta,
    recentTransactions,
  };
}
