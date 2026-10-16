/**
 * The account statement, as a document — the vocabulary every serialiser shares.
 *
 * WHY THIS EXISTS
 *
 * Activity shows a customer what just happened; a statement is what they hand to
 * somebody else — a landlord, an accountant, a visa officer. It is the same
 * ledger, read for a different purpose, so it must say the same things: a
 * statement that named the 2% something else, or quoted a token amount where
 * Activity quotes shillings, would be two interpretations of one ledger and the
 * customer would have to work out which one to believe. This module is where that
 * is decided once.
 *
 * WHAT IT IS NOT
 *
 * Not a second reader of the ledger. `statementRowFrom` calls the SAME
 * `toRecentTransaction` the dashboard and Activity render, so the title a row
 * carries here is the title the customer already saw on the row. The two extra
 * facts a statement needs and a row view does not carry — the platform fee and
 * the receipt reference — are read from the row's own columns (`feeAmount`) and
 * the app's own receipt id (`receiptIdFor`), never recomputed from a rate or
 * derived from an internal id.
 *
 * FIAT ONLY, ALWAYS
 *
 * Every figure here comes from the row's own fiat columns (`fiatAmount`,
 * `feeAmount`, `fiatCurrency`). The token amount (`amount`, `asset`) is
 * deliberately absent from {@link StatementRow}: it is what moved on chain, not
 * what the movement was worth, and a statement exists to be worth something in
 * the customer's own money. There is no asset, token or chain name in any column
 * of any format.
 */
import type { RecentTransaction } from '../types/index.js';
import type { Network } from '../lib/network.js';
import { toRecentTransaction } from './transaction-view.js';

/** The three shapes a statement can be downloaded in. */
export type StatementFormat = 'csv' | 'xlsx' | 'pdf';

export const STATEMENT_FORMATS: readonly StatementFormat[] = ['csv', 'xlsx', 'pdf'];

export function isStatementFormat(value: unknown): value is StatementFormat {
  return typeof value === 'string' && (STATEMENT_FORMATS as readonly string[]).includes(value);
}

/**
 * The media type per format.
 *
 * The XLSX type is the full OOXML one rather than a generic
 * `application/octet-stream`: a browser and an OS both pick the application to
 * open the file from it, and a statement that downloads as an unknown file is a
 * statement nobody can open.
 *
 * CSV is declared UTF-8 because the file carries a BOM and non-ASCII merchant
 * names; without the charset a client is free to guess a single-byte encoding and
 * turn "Nairobi" into mojibake.
 */
export const STATEMENT_CONTENT_TYPE: Record<StatementFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

/** One row of the statement, in the customer's own money. */
export interface StatementRow {
  /** When the row was recorded. Serialised UTC, and labelled as such on the document. */
  date: Date;
  /**
   * What the movement was, as the app already titles the row — the merchant's
   * name, the customer's note, or the ledger's own word for it ("Deposit").
   */
  description: string;
  /**
   * The other party. The merchant's name when the ledger names one, otherwise the
   * address the transfer met, otherwise empty — never an invented name.
   *
   * On a merchant payment this repeats `description`, and that is honest: the
   * app's title for such a row IS the merchant's name. Inventing a different word
   * for one of the two columns would be a second vocabulary for one fact.
   */
  counterparty: string;
  /**
   * The row's own fiat figure, SIGNED: negative when the money left the account,
   * positive when it arrived. Null when the row carries no fiat figure at all —
   * distinctly not zero, which would be a claim that it was worth nothing.
   */
  amount: number | null;
  /**
   * The 2% platform fee charged on this row, in the row's own fiat. Null where no
   * fee applies (a deposit, a transfer between two people). Never called gas, and
   * never netted off the amount.
   */
  platformFee: number | null;
  /** The ledger's own status word, exactly as the API returns it. */
  status: string;
  /**
   * The receipt reference the app gives out for this row — the same opaque id it
   * puts in a `/r/<id>` share link — or null when the row has nothing on chain and
   * therefore no receipt to reference. NEVER the row's database id.
   */
  reference: string | null;
  /** Which way the money moved, from the ledger's own type. */
  direction: 'in' | 'out';
}

/** What the rows in a period come to. */
export interface StatementTotals {
  /** The signed sum of the rows — a net movement, not a gross turnover. */
  amount: number;
  /** The sum of the platform fees on the rows. */
  platformFee: number;
  /**
   * How many rows carry no fiat figure and are therefore absent from both sums.
   * Reported rather than silently dropped, because a total that quietly excludes
   * rows is a wrong total.
   */
  rowsWithoutAmount: number;
}

/** The whole document, as every serialiser reads it. */
export interface StatementDocument {
  /** The account the statement belongs to. One door: it is always the caller's own. */
  account: { email: string };
  network: Network;
  /** The network's product word: Practice | Live. */
  networkLabel: string;
  /** The account's own fiat — "KES" in v1. Every figure in the document is in it. */
  currency: string;
  /** The period the statement covers, inclusive. */
  from: Date;
  to: Date;
  /** When the file was produced. On the document, so an old download explains itself. */
  generatedAt: Date;
  /** Oldest first, the way a ledger reads. */
  rows: StatementRow[];
  totals: StatementTotals;
}

/**
 * A stored ledger row, as the statement reads it.
 *
 * Structural rather than a Prisma type, for the same reason `toRecentTransaction`
 * takes its row structurally: the ONE mapper accepts whatever a `findMany` hands
 * it, which is what lets the statement be read from real rows and from a fixture
 * without a database.
 */
export interface StatementSourceRow {
  id: string;
  type: string;
  /** The token amount. Carried only because the shared mapper reads it; NOT used here. */
  amount: unknown;
  /** The row's own fiat figure — the ONLY source of an amount in a statement. */
  fiatAmount: unknown;
  fiatCurrency: string | null;
  /** The 2% platform fee on this row, in `fiatCurrency`. */
  feeAmount: unknown;
  counterparty: string | null;
  description: string | null;
  createdAt: Date;
  status: string;
  /** The token this row moved. Carried for the shared mapper; NOT printed. */
  asset: string;
  txHash: string | null;
  wallet?: { address: string } | null;
  merchant?: { name: string; category: string | null; payoutAddress: string | null } | null;
}

/** A stored figure as a number, or null when there is none to read. */
function fiatValue(stored: unknown): number | null {
  if (stored === null || stored === undefined) return null;
  if (typeof stored === 'number') return Number.isFinite(stored) ? stored : null;
  if (typeof stored === 'string') {
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // A Prisma `Decimal` (and anything else whose own string form IS the figure).
  // Anything else is not a number and is reported as absent rather than coerced —
  // `Number({})` is NaN, but a coerced figure would be worse than an empty cell.
  if (typeof stored === 'object') {
    const value = Number((stored as { toString(): string }).toString());
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

/** Rounds to 2dp, so a total cannot carry float dust like 10.000000000000002. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * One stored row as a statement row.
 *
 * `reference` is passed in rather than derived here, because the app's receipt id
 * is a keyed HMAC (`receiptIdFor`) and this module deliberately holds no secret:
 * see `services/statement.ts`, which computes it per row and blanks it for a row
 * with nothing on chain.
 */
export function statementRowFrom(
  row: StatementSourceRow,
  reference: string | null
): StatementRow {
  // The SAME description the dashboard and Activity render. One mapper, so a row
  // cannot be called one thing in the app and another on the statement.
  const view: RecentTransaction = toRecentTransaction(row);

  // The other end, from the mapper's own ends — the merchant's payout address is
  // one, the customer's wallet the other, and which is which follows the
  // direction. A merchant's NAME is preferred over its address when the ledger
  // has one, because a statement is read by a person.
  const other = view.direction === 'out' ? view.to : view.from;
  const merchantName = row.merchant?.name?.trim();

  const amount = fiatValue(view.fiatAmount);

  return {
    date: row.createdAt,
    description: view.merchant,
    counterparty: merchantName && merchantName.length > 0 ? merchantName : (other ?? ''),
    // Signed from the ledger's own direction: out is money leaving the account.
    amount:
      amount === null ? null : view.direction === 'out' ? -Math.abs(amount) : Math.abs(amount),
    // Read from the row's own fiat column. Never recomputed from a rate that may
    // since have moved, and never presented as anything but the platform fee.
    platformFee: fiatValue(row.feeAmount),
    status: view.status,
    reference,
    direction: view.direction,
  };
}

/** The rows' totals. */
export function statementTotalsOf(rows: readonly StatementRow[]): StatementTotals {
  let amount = 0;
  let platformFee = 0;
  let rowsWithoutAmount = 0;

  for (const row of rows) {
    if (row.amount === null) rowsWithoutAmount += 1;
    else amount += row.amount;

    if (row.platformFee !== null) platformFee += row.platformFee;
  }

  return { amount: round2(amount), platformFee: round2(platformFee), rowsWithoutAmount };
}

/**
 * The column names, in order, as all three formats write them.
 *
 * One list, so a spreadsheet column and a PDF column cannot come to mean
 * different things. The currency is named on the money columns because a figure
 * without its currency is a number, not an amount — and the currency named is the
 * account's own fiat, never a token.
 */
export function statementHeaders(currency: string): string[] {
  return [
    'Date',
    'Description',
    'Counterparty',
    `Amount (${currency})`,
    `Platform fee (${currency})`,
    'Status',
    'Reference',
  ];
}

/** `2026-10-15T09:12:33.000Z` — the row's instant, unambiguous and sortable. */
export function isoInstant(date: Date): string {
  return date.toISOString();
}

/** `2026-10-15 09:12` — UTC, the form a person reads on the document. */
export function displayTimestamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `15 October 2026` — a date as prose, for the document's own header. */
export function displayDate(date: Date): string {
  const iso = date.toISOString();
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** `2026-10-15` — the day, for a filename. */
export function calendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * A figure as data: `-1234.50`, no grouping.
 *
 * The CSV writer's form. Grouping is deliberately absent — `1,234.50` is two CSV
 * fields, and a spreadsheet reading it gets text where a number belongs.
 */
export function dataAmount(value: number): string {
  return value.toFixed(2);
}

/** A figure as a person reads it: `-1,234.50`, grouped. The PDF writer's form. */
export function displayAmount(value: number): string {
  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * The name of the file a download lands as.
 *
 * `<from>-<to>` are calendar days, so two statements for the same period never
 * collide and the name says what is inside it. Composed here rather than in the
 * route so the header and the document's own period cannot disagree.
 */
export function statementFileName(format: StatementFormat, from: Date, to: Date): string {
  return `seti-statement-${calendarDay(from)}-${calendarDay(to)}.${format}`;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A `from`/`to` query value as an instant, or null when it is not a calendar day. */
function parseDay(value: string, edge: 'start' | 'end'): Date | null {
  const match = DAY.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  // UTC midnight, and the END of the end day: a range is inclusive of both days,
  // so a payment made at 23:40 on the last day is inside a period that names it.
  const iso =
    edge === 'start'
      ? `${year}-${month}-${day}T00:00:00.000Z`
      : `${year}-${month}-${day}T23:59:59.999Z`;
  const instant = new Date(iso);

  // `2026-02-31` matches the pattern and is not a day: `Date` rolls it forward, so
  // the instant is compared back against what was asked for.
  return Number.isNaN(instant.getTime()) || instant.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
    ? null
    : instant;
}

/** A requested period, or the reason it is not one. */
export type StatementRangeResult =
  | { ok: true; from: Date | null; to: Date | null }
  | { ok: false; code: 'invalid-statement-range'; reason: string };

/**
 * The requested period, from the query.
 *
 * Both ends are OPTIONAL and both are days: an omitted `from` starts at the
 * account's first row and an omitted `to` runs to its last, so the default is the
 * whole history. The range is checked for SENSE here rather than trusted — a
 * backwards range is not an empty statement, it is a question that has no answer,
 * and answering it with an empty file would look like the account had no history.
 */
export function parseStatementRange(from: unknown, to: unknown): StatementRangeResult {
  if (from !== undefined && (typeof from !== 'string' || parseDay(from, 'start') === null)) {
    return {
      ok: false,
      code: 'invalid-statement-range',
      reason: 'from must be a calendar day (YYYY-MM-DD).',
    };
  }

  if (to !== undefined && (typeof to !== 'string' || parseDay(to, 'end') === null)) {
    return {
      ok: false,
      code: 'invalid-statement-range',
      reason: 'to must be a calendar day (YYYY-MM-DD).',
    };
  }

  const start = typeof from === 'string' ? parseDay(from, 'start') : null;
  const end = typeof to === 'string' ? parseDay(to, 'end') : null;

  if (start && end && start.getTime() > end.getTime()) {
    return {
      ok: false,
      code: 'invalid-statement-range',
      reason: 'from must not be later than to.',
    };
  }

  return { ok: true, from: start, to: end };
}
