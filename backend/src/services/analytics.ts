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
  /** Who the money came from, for an inbound row. The only identity a payer has. */
  counterparty?: string | null;
  /** The customer-funded fee attributed to a payment, in the asset's units. */
  fee?: string | null;
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
  /** What arrived from other people in this window (#396). */
  received: { count: number; total: number; amounts: number[] };
  /** What left to merchants in this window, with the fee attributed to it. */
  paidOut: { count: number; total: number; fees: number; amounts: number[] };
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
  let paidOut = 0;
  let paidOutFees = 0;
  let paidOutCount = 0;
  let received = 0;
  let receivedCount = 0;
  const paidOutAmounts: number[] = [];
  const receivedAmounts: number[] = [];
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

    /*
     * The same rows, read twice more (#396): what a merchant took and what they spent, with the
     * ticket sizes those two halves have. `payment` is money leaving to a merchant and
     * `p2p_receive` is money arriving from one; a `top_up` is a bridge deposit, so it is money in
     * but not income, and it is deliberately not in either half.
     */
    if (row.type === 'payment') {
      paidOut += amount;
      paidOutCount += 1;
      paidOutAmounts.push(amount);
      const fee = Number(row.fee ?? 0);
      if (Number.isFinite(fee) && fee > 0) paidOutFees += fee;
    }
    if (row.type === 'p2p_receive') {
      received += amount;
      receivedCount += 1;
      receivedAmounts.push(amount);
    }

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
    received: { count: receivedCount, total: received, amounts: receivedAmounts },
    paidOut: { count: paidOutCount, total: paidOut, fees: paidOutFees, amounts: paidOutAmounts },
    daily: fillDays(perDay, days, now),
    merchants: [...merchants.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, MERCHANT_LIMIT),
  };
}

/** One half of the ledger, printed: count, total, and the two ticket sizes (#396). */
export function halfFigures(
  half: { count: number; total: number; amounts: number[] },
  fiatPerUsd: number
): HalfSummary {
  return {
    count: half.count,
    total: toFiat(half.total, fiatPerUsd),
    average: half.count === 0 ? toFiat(0, fiatPerUsd) : toFiat(half.total / half.count, fiatPerUsd),
    median: toFiat(medianOf(half.amounts), fiatPerUsd),
  };
}

/** The middle of a sorted set: the middle value, or the mean of the two middles. */
export function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** A window as the API prints it: converted once, two decimals, no token names. */
export interface WindowSummary {
  days: number;
  in: string;
  out: string;
  net: string;
  count: number;
  skipped: number;
  /** What arrived from other people, and what it averages to (#396). */
  received: HalfSummary;
  /** What left to merchants, with the fee attributed to it. */
  paidOut: HalfSummary & { fee: string };
  merchants: Array<{ name: string; count: number; total: string }>;
  daily: DailyCount[];
}

/** One half of the ledger as a window prints it: a count, a total, and its ticket sizes. */
export interface HalfSummary {
  count: number;
  total: string;
  average: string;
  median: string;
}

/**
 * The people on the other side (#396).
 *
 * A customer is a counterparty address on an inbound payment: the only identity a payer has in this
 * ledger, because Seti never asks them for one. Counted over the ACCOUNT's whole life rather than the
 * selected window, because "haven't paid in 30 days" is a fact about the relationship and not about
 * the period the tab happens to be showing.
 */
export interface CustomersSummary {
  count: number;
  repeat: number;
  lapsed: number;
  top: Array<{ address: string; count: number; total: string }>;
}

export interface AnalyticsSummary {
  currency: string;
  customers: CustomersSummary;
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

/** How long without a payment turns a customer into a win-back (#396). */
export const LAPSED_DAYS = 30;

/** How many customers the tab names, by value. */
export const CUSTOMER_LIMIT = 5;

/** The map spans a year at most: enough to see seasons, short enough to keep one row of squares. */
export const STREAK_DAYS = 365;

/** A strip of days for the map: how many, and when the first one was. */
export interface DayWindow {
  /** How many days the strip covers: a full year in both branches. */
  days: number;
  /** One entry per day, oldest first, zero-filled. The days ahead carry zero. */
  daily: DailyCount[];
  /**
   * Payments in the window. The strip is always a year long now, so "the account has never been
   * paid" is no longer `days === 0` — it is this, and both the starter line and the label read it.
   */
  payments: number;
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
   * The map is the YEAR THE ACCOUNT IS LIVING (#389).
   *
   * It starts on the day the account joined, and it runs a full year: fifty-three columns from the
   * start, so the days ahead are visible as days still to come rather than the grid growing a
   * column at a time. A merchant three days in sees the whole of their first year, with three days
   * behind them and the rest waiting.
   *
   * Once that first year is over the window slides to the last twelve months, so an established
   * account keeps a year of history instead of a grid frozen at its first anniversary. Both cases
   * are 365 days, so the map never changes shape.
   */
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  const joined = startOfUtcDay(user?.createdAt ?? now);
  const firstYearEnd = new Date(joined.getTime() + (STREAK_DAYS - 1) * DAY_MS);

  const spanFirstYear = now <= firstYearEnd;
  const from = spanFirstYear ? joined : new Date(now.getTime() - (STREAK_DAYS - 1) * DAY_MS);
  const to = spanFirstYear ? firstYearEnd : now;

  const rows = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
           count(*) AS count
    FROM transactions
    WHERE "userId" = ${userId}
      AND network = ${network}
      AND status = 'completed'
      AND "createdAt" >= ${from}
      AND type::text IN (${Prisma.join(MONEY_TYPES)})
    GROUP BY 1
    ORDER BY 1
  `;

  const perDay = new Map<string, number>(rows.map((row) => [row.date, Number(row.count)]));
  const daily = fillRange(perDay, from, to);
  const payments = daily.reduce((sum, day) => sum + day.count, 0);
  return { days: daily.length, daily, payments };
}

/** UTC midnight of a date, so a window never starts or ends mid-day. */
function startOfUtcDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/** One entry per day from `from` to `to`, inclusive, oldest first. */
export function fillRange(perDay: Map<string, number>, from: Date, to: Date): DailyCount[] {
  const out: DailyCount[] = [];
  for (let at = from.getTime(); at <= to.getTime(); at += DAY_MS) {
    const date = dayKey(new Date(at));
    out.push({ date, count: perDay.get(date) ?? 0 });
  }
  return out;
}

/**
 * Who pays this account, and whether they come back (#396).
 *
 * Read over the account's whole life: a customer who paid once in March and never again is exactly
 * the person a merchant wants named, and a thirty-day window would hide them. Nothing here is
 * inferred: a customer is a `counterparty` address on a completed inbound row, and a repeat is one
 * that appears twice.
 *
 * `lapsed` is the win-back list: last payment more than thirty days before `now`.
 */
export async function getCustomers(
  userId: string,
  network: Network,
  now: Date,
  fiatPerUsd: number
): Promise<CustomersSummary> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      network,
      status: 'completed',
      type: 'p2p_receive',
      counterparty: { not: null },
    },
    select: { counterparty: true, amount: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const perAddress = new Map<string, { count: number; total: number; last: Date }>();
  for (const row of rows) {
    const address = String(row.counterparty).toLowerCase();
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    const entry = perAddress.get(address) ?? { count: 0, total: 0, last: row.createdAt };
    entry.count += 1;
    entry.total += amount;
    if (row.createdAt > entry.last) entry.last = row.createdAt;
    perAddress.set(address, entry);
  }

  const lapsedBefore = now.getTime() - LAPSED_DAYS * DAY_MS;
  let repeat = 0;
  let lapsed = 0;
  for (const entry of perAddress.values()) {
    if (entry.count >= 2) repeat += 1;
    if (entry.last.getTime() < lapsedBefore) lapsed += 1;
  }

  return {
    count: perAddress.size,
    repeat,
    lapsed,
    top: [...perAddress.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, CUSTOMER_LIMIT)
      .map(([address, entry]) => ({
        address,
        count: entry.count,
        total: toFiat(entry.total, fiatPerUsd),
      })),
  };
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
    counterparty: row.counterparty,
    fee: row.feeAmount?.toString() ?? null,
  }));

  const fiatPerUsd = await getFiatPerUsd(currency);
  const year = await getDailyYear(userId, network, now);
  const customers = await getCustomers(userId, network, now, fiatPerUsd);

  return {
    currency,
    customers,
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
        received: halfFigures(totals.received, fiatPerUsd),
        paidOut: {
          ...halfFigures(totals.paidOut, fiatPerUsd),
          fee: toFiat(totals.paidOut.fees, fiatPerUsd),
        },
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
