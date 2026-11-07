export const ANALYTICS_COPY = {
  in: 'Money in',
  out: 'Money out',
  net: 'Net',
  merchantsTitle: 'Where it went',
  merchantsEmpty: 'No payments in this window.',
  emptyTitle: 'Nothing in this window',
  emptyBody: 'Payments and transfers will add up here once there are some.',
  errorTitle: "Couldn't load your figures",
  retry: 'Try again',
  loading: 'Loading your figures',
  /* The two halves of the window (#396). */
  halvesTitle: 'What moved',
  received: 'Received',
  spent: 'Spent',
  fee: 'Fee',
  feeNote: 'Funded by the customer inside their own transfer.',
  ticket: (count: number, average: string, median: string): string =>
    `${count === 1 ? '1 payment' : `${count} payments`} · average ${average} · median ${median}`,
  /* How regular the trade is (#393). */
  consistencyTitle: 'Consistency',
  activeDays: 'Active days',
  activeDaysValue: (count: number): string => `${count} of the last 30`,
  bestDay: 'Best day',
  bestDayValue: (date: string, count: number): string =>
    `${dayAndMonth(date)} · ${count === 1 ? '1 payment' : `${count} payments`}`,
  drySpell: 'Since a payment',
  drySpellValue: (days: number): string => {
    if (days === 0) return 'Today';
    return days === 1 ? '1 day' : `${days} days`;
  },
  /* The people on the other side (#396). */
  customersTitle: 'Customers',
  customersLine: (count: number, repeat: number, lapsed: number): string =>
    `${count === 1 ? '1 wallet has' : `${count} wallets have`} paid you · ${repeat} came back · ${lapsed} not in 30 days`,
  customerPayments: (count: number): string =>
    count === 1 ? '1 payment' : `${count} payments`,
  /** Names the window switcher for a screen reader. */
  windowLabel: 'Period',
} as const;

/**
 * What a window's figures are, in words, when the range is not the last 30 days.
 *
 * `formatFiat` always prints the currency code, so the only thing this builds is the
 * sentence around it — the money itself is never assembled by concatenation.
 */
export function skippedNote(count: number): string {
  return count === 1
    ? '1 movement could not be read, so the figures may be short by it.'
    : `${count} movements could not be read, so the figures may be short by them.`;
}

/** `6 Nov`, from a `YYYY-MM-DD` key, without asking the browser for a locale. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function dayAndMonth(date: string): string {
  const month = Number(date.slice(5, 7)) - 1;
  return `${Number(date.slice(8, 10))} ${MONTHS[month]}`;
}

export function windowLabel(days: number): string {
  return days === 7 ? 'Last 7 days' : `Last ${days} days`;
}
