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

export function windowLabel(days: number): string {
  return days === 7 ? 'Last 7 days' : `Last ${days} days`;
}
