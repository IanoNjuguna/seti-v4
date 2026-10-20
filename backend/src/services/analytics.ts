import type { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getFiatPerUsd } from './payments.js';
import type { Network } from '../lib/network.js';
import { servedNetwork } from '../config/networks.js';

/**
 * What the account's money did over a window.
 *
 * The activity list is paginated, so nothing on the client can summarise the account:
 * the first page is not the history. This is the query instead of a reduction, and it
 * is deliberately narrow — it reports what settled transactions PROVE and nothing else.
 * No categories (we do not record any), no comparison to a previous period (no query
 * for it), no chart data.
 *
 * Money is summed in the asset's own units, which are 1:1 USD for every supported
 * stablecoin, and converted ONCE at the end — the same rule the balance card follows.
 * Summing stored `fiatAmount` values instead would mix whatever rate each row happened
 * to be written with, and two rows from different weeks would silently add up to a
 * figure that belongs to no single day.
 */

/** The windows the surface asks for. One query serves both. */
export const ANALYTICS_WINDOWS = [7, 30] as const;
export type AnalyticsDays = (typeof ANALYTICS_WINDOWS)[number];

/**
 * Which way money moved for a ledger type.
 *
 * `null` means "this type does not move money the customer counts" — and, importantly,
 * a type added later lands here rather than being counted twice by a default branch.
 */
export function directionOf(type: TransactionType): 'in' | 'out' | null {
  switch (type) {
    case 'p2p_receive':
    case 'top_up':
      return 'in';
    case 'payment':
    case 'p2p_send':
    case 'withdrawal':
    case 'fee':
      return 'out';
    default:
      return null;
  }
}

/** The shape this module needs from a transaction. Narrow on purpose, so it can be
 * built by hand in a check without a database. */
export interface AnalyticsRow {
  type: TransactionType;
  status: TransactionStatus;
  /** The asset amount, as the ledger holds it. */
  amount: string | number;
  createdAt: Date;
  /** The merchant's name for a payment, null for everything else. */
  merchantName: string | null;
}

export interface MerchantTotal {
  name: string;
  count: number;
  total: number;
}

export interface WindowTotals {
  days: number;
  /** Money in, in USD units. */
  in: number;
  /** Money out, in USD units. */
  out: number;
  /** in minus out. Never computed by a second pass over the rows. */
  net: number;
  /** Settled transactions counted. */
  count: number;
  /**
   * Rows the window could not read (a malformed amount). Reported rather than dropped:
   * a summary that silently omits rows is a figure nobody can reconcile.
   */
  skipped: number;
  /** Payments to a named merchant, most paid first, capped at three. */
  merchants: MerchantTotal[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MERCHANT_LIMIT = 3;

/**
 * One window over rows already in memory.
 *
 * Only `completed` counts: a pending transfer is not money in or out, and counting it
 * would make the summary disagree with the balance the customer can spend.
 */
export function summariseWindow(rows: AnalyticsRow[], days: number, now: Date): WindowTotals {
  const since = now.getTime() - days * DAY_MS;
  let moneyIn = 0;
  let moneyOut = 0;
  let count = 0;
  let skipped = 0;
  const merchants = new Map<string, MerchantTotal>();

  for (const row of rows) {
    if (row.status !== 'completed') continue;
    if (row.createdAt.getTime() < since) continue;

    const direction = directionOf(row.type);
    if (direction === null) continue;

    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      skipped += 1;
      continue;
    }

    count += 1;
    if (direction === 'in') moneyIn += amount;
    else moneyOut += amount;

    if (direction === 'out' && row.type === 'payment' && row.merchantName) {
      const entry = merchants.get(row.merchantName) ?? { name: row.merchantName, count: 0, total: 0 };
      entry.count += 1;
      entry.total += amount;
      merchants.set(row.merchantName, entry);
    }
  }

  return {
    days,
    in: moneyIn,
    out: moneyOut,
    net: moneyIn - moneyOut,
    count,
    skipped,
    merchants: [...merchants.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, MERCHANT_LIMIT),
  };
}

/** A window as the API prints it: converted once, two decimals, no token names. */
export interface WindowSummary {
  days: number;
  in: string;
  out: string;
  net: string;
  count: number;
  skipped: number;
  merchants: Array<{ name: string; count: number; total: string }>;
}

export interface AnalyticsSummary {
  currency: string;
  windows: WindowSummary[];
}

/** The widest window, so one query serves every window the surface shows. */
const WIDEST = Math.max(...ANALYTICS_WINDOWS);

function toFiat(amount: number, fiatPerUsd: number): string {
  return (amount * fiatPerUsd).toFixed(2);
}

/**
 * Read the account's own transactions and summarise them.
 *
 * Scoped by network, like every other money read: a practice balance is not a live one,
 * and a practice payment must not appear in a live summary.
 */
export async function getAnalytics(
  userId: string,
  currency: string,
  network: Network = servedNetwork,
  now: Date = new Date()
): Promise<AnalyticsSummary> {
  const since = new Date(now.getTime() - WIDEST * DAY_MS);

  const rows = await prisma.transaction.findMany({
    where: { userId, network, status: 'completed', createdAt: { gte: since } },
    include: { merchant: true },
    orderBy: { createdAt: 'desc' },
  });

  const analyticsRows: AnalyticsRow[] = rows.map((row) => ({
    type: row.type,
    status: row.status,
    amount: row.amount.toString(),
    createdAt: row.createdAt,
    merchantName: row.merchant?.name ?? null,
  }));

  const fiatPerUsd = await getFiatPerUsd(currency);

  return {
    currency,
    windows: ANALYTICS_WINDOWS.map((days) => {
      const totals = summariseWindow(analyticsRows, days, now);
      return {
        days: totals.days,
        in: toFiat(totals.in, fiatPerUsd),
        out: toFiat(totals.out, fiatPerUsd),
        net: toFiat(totals.net, fiatPerUsd),
        count: totals.count,
        skipped: totals.skipped,
        merchants: totals.merchants.map((merchant) => ({
          name: merchant.name,
          count: merchant.count,
          total: toFiat(merchant.total, fiatPerUsd),
        })),
      };
    }),
  };
}
