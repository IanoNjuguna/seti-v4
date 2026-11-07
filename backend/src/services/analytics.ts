import type { TransactionStatus, TransactionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getFiatPerUsd } from './payments.js';
import { localMoment, resolveTimeZone } from './time-zone.js';
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
  /** Whether `name` is a merchant's own name or a wallet address standing in for one (#402). */
  kind?: 'merchant' | 'address';
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
  /** Seven weekdays of twenty-four hours, counts of inbound payments, in the account's zone (#394). */
  busyHours: number[][];
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
export function summariseWindow(
  rows: AnalyticsRow[],
  days: number,
  now: Date,
  timeZone: string
): WindowTotals {
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
  // Seven weekdays, twenty-four hours, in the account's zone (#394).
  const busy: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
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

    // The day a movement belongs to is the ACCOUNT's day, not UTC's (#394).
    const day = localMoment(row.createdAt, timeZone).date;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);

    if (row.type === 'p2p_receive') {
      const moment = localMoment(row.createdAt, timeZone);
      const row4 = busy[moment.weekday];
      if (row4) row4[moment.hour] = (row4[moment.hour] ?? 0) + 1;
    }

    /*
     * WHO THE MONEY WENT TO (#402): a merchant by name, or the address it went to.
     *
     * This used to count only `payment` rows that carried a merchant record, so an account that had
     * paid people — or a merchant whose record was never attached — saw `Money out` above a panel
     * saying "No payments in this window". The address is the fallback because it is the only other
     * identity the ledger holds, and it is what the person would see on the chain anyway.
     */
    if (direction === 'out' && (row.type === 'payment' || row.type === 'p2p_send')) {
      // A merchant's own name only means something on a `payment`; a send to a person is their address.
      const label = row.type === 'payment' ? (row.merchantName ?? row.counterparty) : row.counterparty;
      if (label) {
        const named = row.type === 'payment' && Boolean(row.merchantName);
      const key = named ? `m:${label}` : `a:${label.toLowerCase()}`;
        const entry = merchants.get(key) ?? {
          name: label,
          kind: named ? ('merchant' as const) : ('address' as const),
          count: 0,
          total: 0,
        };
        entry.count += 1;
        entry.total += amount;
        merchants.set(key, entry);
      }
    }
  }

  return {
    days,
    in: moneyIn,
    out: moneyOut,
    net: moneyIn - moneyOut,
    count,
    skipped,
    busyHours: busy,
    received: { count: receivedCount, total: received, amounts: receivedAmounts },
    paidOut: { count: paidOutCount, total: paidOut, fees: paidOutFees, amounts: paidOutAmounts },
    daily: fillDays(perDay, days, now),
    merchants: [...merchants.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, MERCHANT_LIMIT),
  };
}

/**
 * The busy grid, or null below the floor (#394).
 *
 * The peaks are found by flattening seven by twenty-four into one list, sorting by count and taking
 * the top three. Ties fall back to weekday then hour so the answer is stable between reads: a
 * merchant comparing two windows should not see the named slots reorder because two cells happened
 * to hold the same count.
 */
export function busyHoursSummary(buckets: number[][], floor = BUSY_HOURS_FLOOR): BusyHoursSummary | null {
  let total = 0;
  const flat: Array<{ weekday: number; fromHour: number; count: number }> = [];

  buckets.forEach((week, weekday) => {
    week.forEach((count, hour) => {
      total += count;
      if (count > 0) flat.push({ weekday, fromHour: hour, count });
    });
  });

  if (total < floor) return null;

  flat.sort((a, b) => b.count - a.count || a.weekday - b.weekday || a.fromHour - b.fromHour);

  return {
    buckets,
    total,
    peaks: flat.slice(0, 3).map((peak) => ({
      weekday: peak.weekday,
      fromHour: peak.fromHour,
      toHour: (peak.fromHour + 1) % 24,
      count: peak.count,
    })),
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

/**
 * Settlement as the tab prints it (#395).
 *
 * Pure, and given the rows: a pending row is one that has neither completed nor failed, and its age
 * is measured from when it was written. `medianHours` and `worstHours` come only from rows that
 * carry a `settledAt`, because a movement without one has no duration to average rather than a
 * duration of zero.
 */
export function summariseSettlement(
  rows: Array<{ status: string; createdAt: Date; settledAt: Date | null }>,
  now: Date
): SettlementSummary {
  let pending = 0;
  let oldest: number | null = null;
  const hours: number[] = [];

  for (const row of rows) {
    if (row.status !== 'completed' && row.status !== 'failed') {
      pending += 1;
      const age = (now.getTime() - row.createdAt.getTime()) / HOUR_MS;
      oldest = oldest === null ? age : Math.max(oldest, age);
      continue;
    }
    if (row.settledAt) {
      const duration = (row.settledAt.getTime() - row.createdAt.getTime()) / HOUR_MS;
      if (Number.isFinite(duration) && duration >= 0) hours.push(duration);
    }
  }

  return {
    pending,
    oldestPendingHours: oldest === null ? null : Math.round(oldest * 10) / 10,
    settledCount: hours.length,
    medianHours: hours.length === 0 ? null : Math.round(medianOf(hours) * 100) / 100,
    worstHours: hours.length === 0 ? null : Math.round(Math.max(...hours) * 100) / 100,
  };
}

/**
 * The last thirty days of a year series, read for rhythm (#393).
 *
 * Days ahead carry zero and are dropped rather than counted as quiet: a day that has not happened
 * cannot be part of "how many days did you trade". `drySpellDays` falls back to the first day with a
 * movement ever, so a brand-new account with nothing paid reports its age rather than an enormous gap.
 */
export function consistencyOf(daily: DailyCount[], today: string): ConsistencySummary {
  const behind = daily.filter((day) => day.date <= today);
  const last30 = behind.slice(-30);

  let best: DailyCount | null = null;
  for (const day of last30) {
    if (day.count > 0 && (!best || day.count > best.count)) best = day;
  }

  const lastActive = [...behind].reverse().find((day) => day.count > 0);
  const drySpellDays = lastActive ? daysBetweenKeys(lastActive.date, today) : null;

  return {
    activeDays: last30.filter((day) => day.count > 0).length,
    bestDay: best ? { date: best.date, count: best.count } : null,
    drySpellDays,
  };
}

/** Whole days from one `YYYY-MM-DD` key to another, never negative. */
export function daysBetweenKeys(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / DAY_MS));
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
  /** When the counter is busy (#394): seven weekdays by twenty-four hours, or null below the floor. */
  busyHours: BusyHoursSummary | null;
  /** What left to merchants, with the fee attributed to it. */
  paidOut: HalfSummary & { fee: string };
  merchants: Array<{ name: string; count: number; total: string }>;
  daily: DailyCount[];
}

/**
 * When the money arrives (#394).
 *
 * `buckets` is seven weekdays by twenty-four hours in the ACCOUNT's zone, counting inbound payments.
 * `peaks` is the same data read for a reader who will not count squares: the three busiest slots, each
 * named as a weekday and an hour range.
 *
 * Null rather than an empty grid when the window is too thin to say anything: twelve payments spread
 * over a hundred and sixty-eight cells is a pattern that only exists in the noise, and a field of dots
 * reads as a finding.
 */
export interface BusyHoursSummary {
  buckets: number[][];
  peaks: Array<{ weekday: number; fromHour: number; toHour: number; count: number }>;
  total: number;
}

/** Below this many inbound payments in the window, the grid is noise rather than a rhythm. */
export const BUSY_HOURS_FLOOR = 50;

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

/**
 * How steady the account is (#393), read off the same year the streak map draws.
 *
 * The tab reports totals for a window; this reports whether the business is regular. `activeDays` is
 * out of the last thirty days, `bestDay` is the busiest of them, and `drySpellDays` is how long since
 * anything moved at all — a fact about the account, not about the selected window, so a quiet week
 * after a busy month still shows a real gap rather than a zero.
 */
export interface ConsistencySummary {
  activeDays: number;
  bestDay: { date: string; count: number } | null;
  /**
   * Days since the last movement, or null when nothing has ever moved.
   *
   * Null rather than the account's age: "3 days" beside a new account reads as three days of not
   * working, when what is true is that there has been no first payment yet.
   */
  drySpellDays: number | null;
}

/**
 * How the settlement is going (#395).
 *
 * Every payment is reconciled against its receipt before it is recorded, and nothing on the screen
 * said so as a figure. `pending` counts rows that have not landed; `medianHours` and `worstHours` say
 * how long a movement takes from being written to being settled.
 */
export interface SettlementSummary {
  pending: number;
  oldestPendingHours: number | null;
  settledCount: number;
  medianHours: number | null;
  worstHours: number | null;
}

export interface AnalyticsSummary {
  currency: string;
  /** The zone these figures were counted in (#394), so a reader can see which calendar they are on. */
  timeZone: string;
  customers: CustomersSummary;
  consistency: ConsistencySummary;
  settlement: SettlementSummary;
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

/** One hour, for the settlement figures (#395). */
const HOUR_MS = 3_600_000;

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
  now: Date,
  timeZone: string
): Promise<DayWindow> {
  /*
   * The map is the YEAR THE ACCOUNT IS LIVING (#389), counted in the account's own zone (#394).
   *
   * It runs from the day the account joined to the day before that anniversary, so the days ahead
   * are visible as days still to come rather than the grid growing a column at a time; once that
   * year is over the window slides to the last twelve months. Both are 365 days, so the map never
   * changes shape.
   *
   * The day a payment belongs to is the ACCOUNT's day. `AT TIME ZONE` names a zone in the database
   * rather than an offset, so a merchant in a place that moves its clocks still gets their own
   * calendar rather than UTC's.
   *
   * THE DOUBLE CONVERSION IS NOT REDUNDANT. Prisma stores a `DateTime` as `timestamp WITHOUT time
   * zone` holding UTC, so `"createdAt" AT TIME ZONE 'Africa/Nairobi'` REINTERPRETS the stored UTC
   * clock as Nairobi wall time and lands a day early — proved against the dev database before this
   * shipped. The first `AT TIME ZONE 'UTC'` says "this naive value is UTC" and yields a real instant;
   * the second renders that instant in the account's zone.
   */
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, timeZone: true },
  });
  const zone = resolveTimeZone(user?.timeZone ?? timeZone);

  const joinedKey = localMoment(user?.createdAt ?? now, zone).date;
  const todayKey = localMoment(now, zone).date;
  const firstYearEnd = addDaysToKey(joinedKey, STREAK_DAYS - 1);

  const spanFirstYear = todayKey <= firstYearEnd;
  const fromKey = spanFirstYear ? joinedKey : addDaysToKey(todayKey, -(STREAK_DAYS - 1));
  const toKey = spanFirstYear ? firstYearEnd : todayKey;

  const rows = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
    SELECT to_char(date_trunc('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${zone}),
                   'YYYY-MM-DD') AS date,
           count(*) AS count
    FROM transactions
    WHERE "userId" = ${userId}
      AND network = ${network}
      AND status = 'completed'
      AND "createdAt" >= ${startOfKeyUtc(fromKey, zone)}
      AND type::text IN (${Prisma.join(MONEY_TYPES)})
    GROUP BY 1
    ORDER BY 1
  `;

  const perDay = new Map<string, number>(rows.map((row) => [row.date, Number(row.count)]));
  const daily = fillDateKeys(perDay, fromKey, toKey);
  const payments = daily.reduce((sum, day) => sum + day.count, 0);
  return { days: daily.length, daily, payments };
}

/** `YYYY-MM-DD` plus whole days, by date arithmetic that never touches a zone. */
export function addDaysToKey(key: string, days: number): string {
  const at = Date.parse(`${key}T00:00:00Z`) + days * DAY_MS;
  return new Date(at).toISOString().slice(0, 10);
}

/**
 * The instant a local day begins, for a lower bound on the query.
 *
 * Being a few hours early is harmless — the query is only a filter and the grouping does the real
 * work — while being a few hours late would silently drop the first day of the window.
 */
function startOfKeyUtc(key: string, _timeZone: string): Date {
  const midnight = new Date(`${key}T00:00:00Z`);
  // The widest zone offset in the world is +14:00, so a day earlier is always early enough.
  return new Date(midnight.getTime() - 14 * HOUR_MS);
}

/** One entry per local day from `fromKey` to `toKey`, inclusive, oldest first. */
export function fillDateKeys(perDay: Map<string, number>, fromKey: string, toKey: string): DailyCount[] {
  const out: DailyCount[] = [];
  let key = fromKey;
  while (key <= toKey) {
    out.push({ date: key, count: perDay.get(key) ?? 0 });
    key = addDaysToKey(key, 1);
  }
  return out;
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
  const zone = resolveTimeZone(
    (await prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true } }))?.timeZone
  );
  const year = await getDailyYear(userId, network, now, zone);
  const customers = await getCustomers(userId, network, now, fiatPerUsd);
  const consistency = consistencyOf(year.daily, dayKey(now));
  const settlement = summariseSettlement(
    await prisma.transaction.findMany({
      where: { userId, network, createdAt: { gte: since } },
      select: { status: true, createdAt: true, settledAt: true },
    }),
    now
  );

  return {
    currency,
    timeZone: zone,
    customers,
    consistency,
    settlement,
    windows: ANALYTICS_WINDOWS.map((days) => {
      const totals = summariseWindow(analyticsRows, days, now, zone);
      const figures = convertWindow(totals, fiatPerUsd);
      return {
        days: totals.days,
        in: figures.in,
        out: figures.out,
        net: figures.net,
        count: totals.count,
        skipped: totals.skipped,
        busyHours: busyHoursSummary(totals.busyHours),
        received: halfFigures(totals.received, fiatPerUsd),
        paidOut: {
          ...halfFigures(totals.paidOut, fiatPerUsd),
          fee: toFiat(totals.paidOut.fees, fiatPerUsd),
        },
        merchants: totals.merchants.map((merchant) => ({
          name: merchant.name,
          kind: merchant.kind ?? 'merchant',
          count: merchant.count,
          total: toFiat(merchant.total, fiatPerUsd),
        })),
        daily: totals.daily,
      };
    }),
    year,
  };
}
