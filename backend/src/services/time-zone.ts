/**
 * Days and hours as the ACCOUNT experiences them (#394).
 *
 * Every timestamp in this product is stored in UTC, which is correct: an instant is an instant. A
 * calendar day is not an instant. "Saturday" is a business fact — the day a merchant traded, the day
 * an accountant reads on a statement — so it is computed against a named zone, and that zone is the
 * account's own (`User.timeZone`), never the reader's device and never UTC.
 *
 * ## No offset arithmetic, ever
 *
 * `+03:00` is right for Nairobi and wrong for anywhere that moves its clocks. ICU ships with Node,
 * so `Intl.DateTimeFormat` answers "what is the local weekday and hour of this instant" for any IANA
 * name, daylight saving included. Two rules follow from that: one formatter per zone, cached (a
 * formatter per row is seconds of work for a table), and no hand-built date arithmetic.
 *
 * ## The fallback is a real place, not UTC
 *
 * An unparseable or hostile zone string would otherwise throw on every request for that account.
 * `Africa/Nairobi` is this product's home market, so an account with a broken value still buckets its
 * days somewhere the merchant would recognise.
 */

/** Where days are counted when an account's zone cannot be read. */
export const FALLBACK_TIME_ZONE = 'Africa/Nairobi';

const formatters = new Map<string, Intl.DateTimeFormat>();

/** One cached formatter per zone: constructing these per row is the difference between a table and a stall. */
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;

  const made = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  formatters.set(timeZone, made);
  return made;
}

/** True when the string is a zone this runtime can actually resolve. */
export function isKnownTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The zone to use, or the fallback when the stored one is not resolvable. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return FALLBACK_TIME_ZONE;
  return isKnownTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
}

export interface LocalMoment {
  /** `YYYY-MM-DD` in the account's zone — the calendar day the movement belongs to. */
  date: string;
  /** Monday-first weekday, 0..6. */
  weekday: number;
  /** 0..23 in the account's zone. */
  hour: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** The day, weekday and hour an instant falls on IN THE ACCOUNT's ZONE. */
export function localMoment(at: Date, timeZone: string): LocalMoment {
  const parts = formatterFor(timeZone).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekdayName = read('weekday');
  // `hour` reads `24` for midnight in some locales' 24-hour cycle; the clock says 0.
  const hour = Number(read('hour')) % 24;

  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    weekday: WEEKDAY_INDEX[weekdayName] ?? 0,
    hour: Number.isFinite(hour) ? hour : 0,
  };
}
