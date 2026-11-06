import type { TransactionStatus, TransactionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
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
 * `null` means "this type does not move money the customer counts". This is a TOTAL record
 * over the enum rather than a switch with a default, so a type added to the schema fails the
 * typecheck until somebody decides which way it moves — the default branch it replaced would
 * have quietly ignored it, and a new money type that nobody classifies is money missing from
 * every total on the surface.
 */
const DIRECTION: Record<TransactionType, 'in' | 'out' | null> = {
  p2p_receive: 'in',
  top_up: 'in',
  payment: 'out',
  p2p_send: 'out',
  withdrawal: 'out',
  fee: 'out',
  /* The customer's own money changing shape inside their account, not money arriving or
     leaving: a swap between two of their assets, a deposit into the vault, a withdrawal from
     it. Counting any of these would double-count the same dollars on a screen that claims to
     show what the money did. */
  convert: null,
  savings_deposit: null,
  savings_withdrawal: null,
};

export function directionOf(type: TransactionType): 'in' | 'out' | null {
  return DIRECTION[type] ?? null;
}

/** The types that move money, derived rather than listed twice — the SQL below needs them. */
export const MONEY_TYPES = (Object.keys(DIRECTION) as TransactionType[]).filter(
  (type) => DIRECTION[type] !== null
);

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
  /**
   * One entry per day in the window, oldest first, zero-filled (#369).
   *
   * The surface draws a streak map from this, and a map with holes in it is a lie about
   * the quiet days: a day with no payments is a fact, not a missing row. The date key is
   * the UTC calendar day, which is the same basis the window itself counts on.
   */
  daily: DailyCount[];
}

/** How many money movements a UTC day carried. */
export interface DailyCount {
  /** `YYYY-MM-DD`, UTC. */
  date: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MERCHANT_LIMIT = 3;

/** `YYYY-MM-DD` in UTC, the calendar day the window counts on. */
export function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * The window as one entry per day, oldest first.
 *
 * Zero-filled on purpose: the streak map draws a square for every day, and a day the
 * customer took no money is the absence the map is FOR. Dropping empty days would turn
 * thirty days into a list of good days and make a sparse month look busy.
 */
export function fillDays(perDay: Map<string, number>, days: number, now: Date): DailyCount[] {
  const out: DailyCount[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = dayKey(new Date(now.getTime() - offset * DAY_MS));
    out.push({ date, count: perDay.get(date) ?? 0 });
  }
  return out;
}

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
  const perDay = new Map<string, number>();

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

    const day = dayKey(row.createdAt);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);

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
    daily: fillDays(perDay, days, now),
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
  daily: DailyCount[];
}

export interface AnalyticsSummary {
  currency: string;
  windows: WindowSummary[];
  /**
   * The map's series: a full year of days, counted in the database (#371).
   *
   * The windows above are totals; this is one number per day for a year, so it is a
   * `GROUP BY` rather than the rows: a merchant with a busy year would otherwise load every
   * transaction they have ever taken to draw a picture of which days they worked.
   */
  year: DayWindow;
}

/** The map spans a year at most: enough to see seasons, short enough to keep one row of squares. */
export const STREAK_DAYS = 365;

/** A strip of days for the map: how many, and when the first one was. */
export interface DayWindow {
  /** How many days the strip covers. Zero when the account has never taken a payment. */
  days: number;
  /** One entry per day, oldest first, zero-filled. Empty when `days` is zero. */
  daily: DailyCount[];
}

/** The widest window, so one query serves every window the surface shows. */
const WIDEST = Math.max(...ANALYTICS_WINDOWS);

function toFiat(amount: number, fiatPerUsd: number): string {
  return (amount * fiatPerUsd).toFixed(2);
}

export interface WindowFigures {
  in: string;
  out: string;
  net: string;
}

/**
 * The three figures a panel shows, reconciled by construction.
 *
 * Converting each of the three independently is how the smoke found a cent missing:
 * in, out and net were rounded separately, so a customer subtracting the first two did
 * not get the third. The net is therefore not converted at all here — it is the
 * difference of the two figures as printed, which is the only definition that survives
 * rounding.
 *
 * Rates that produce awkward cents are the point, not the edge case: 129.5 turns
 * 1,234,567.89 USD into a figure ending in .655, and half-up rounding then decides
 * which way each of the three goes.
 */
export function convertWindow(totals: Pick<WindowTotals, 'in' | 'out'>, fiatPerUsd: number): WindowFigures {
  const rate = Number.isFinite(fiatPerUsd) ? fiatPerUsd : 0;
  const inCents = Math.round(totals.in * rate * 100);
  const outCents = Math.round(totals.out * rate * 100);

  return {
    in: (inCents / 100).toFixed(2),
    out: (outCents / 100).toFixed(2),
    net: ((inCents - outCents) / 100).toFixed(2),
  };
}

/**
 * One year of days, counted where the data is.
 *
 * `Prisma.join(MONEY_TYPES)` rather than a hand-written list: the types that count are
 * `directionOf`'s own, so the map cannot disagree with the totals about which movements are
 * money. `to_char` pins the bucket to UTC, the same calendar day the windows count on.
 */
export async function getDailyYear(
  userId: string,
  network: Network,
  now: Date
): Promise<DayWindow> {
  /*
   * The map starts where the account started, not a year ago (#375).
   *
   * A fixed 365-day window drew 371 pale squares and one green dot for a merchant three days
   * old, under a label that claimed a year of history that did not exist. So the span is
   * `max(first payment, a year ago)`: a new account gets a short strip that grows as it trades,
   * an established one gets the full year, and the label can say which it is.
   *
   * No payments at all returns zero days, and the caller hides the grid rather than drawing a
   * year of nothing: the map is evidence, and a surface with no evidence says so in words.
   */
  const first = await prisma.transaction.findFirst({
    where: {
      userId,
      network,
      status: 'completed',
      type: { in: MONEY_TYPES },
    },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  if (!first) return { days: 0, daily: [] };

  const oldest = new Date(now.getTime() - (STREAK_DAYS - 1) * DAY_MS);
  const since = first.createdAt > oldest ? first.createdAt : oldest;
  const rows = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
           count(*) AS count
    FROM transactions
    WHERE "userId" = ${userId}
      AND network = ${network}
      AND status = 'completed'
      AND "createdAt" >= ${since}
      AND type::text IN (${Prisma.join(MONEY_TYPES)})
    GROUP BY 1
    ORDER BY 1
  `;

  const perDay = new Map<string, number>(rows.map((row) => [row.date, Number(row.count)]));
  const daily = fillDays(perDay, STREAK_DAYS, now).slice(-daysBetween(since, now));
  return { days: daily.length, daily };
}

/** Whole days from `since` to `now`, inclusive — the length of the strip the map draws. */
export function daysBetween(since: Date, now: Date): number {
  const start = Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate());
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((end - start) / DAY_MS) + 1;
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
  const year = await getDailyYear(userId, network, now);

  return {
    currency,
    windows: ANALYTICS_WINDOWS.map((days) => {
      const totals = summariseWindow(analyticsRows, days, now);
      const figures = convertWindow(totals, fiatPerUsd);
      return {
        days: totals.days,
        in: figures.in,
        out: figures.out,
        net: figures.net,
        count: totals.count,
        skipped: totals.skipped,
        merchants: totals.merchants.map((merchant) => ({
          name: merchant.name,
          count: merchant.count,
          total: toFiat(merchant.total, fiatPerUsd),
        })),
        daily: totals.daily,
      };
    }),
    year,
  };
}
