import { SHORT_ADDRESS_LEAD, SHORT_ADDRESS_TAIL } from '@/lib/charges/charge.constants';
import type { PayeeDisplay } from '@/lib/charges/charge.types';

/**
 * The formatting the pay page needs, all of it deterministic.
 *
 * **No `new Date()`.** Every date drawn here comes from an instant the charge stored,
 * and it is printed in one named zone (EAT, where the product's customers are). A
 * value read off the server's clock would print the server's timezone on a page a
 * phone in Nairobi is reading, and would differ again in a browser — the hydration
 * bug this repo has already paid for. "Now" is used for exactly one decision (has the
 * deadline passed) and it happens in `loadCharge`, server-side, before any of this.
 */
const DAY_FORMAT = new Intl.DateTimeFormat('en-KE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Africa/Nairobi',
});

/** `2026-09-30T06:00:00.000Z` → `30 September 2026`. */
export function formatDay(iso: string): string {
  return DAY_FORMAT.format(new Date(iso));
}

/**
 * An address short enough to read at 13px beside a badge, with both ends showing.
 *
 * The full address is always in the element's `title` (and in the HTML), because
 * truncation exists to help a person recognise an address, never to hide one.
 */
export function shortAddress(address: string): string {
  if (address.length <= SHORT_ADDRESS_LEAD + SHORT_ADDRESS_TAIL + 1) return address;
  return `${address.slice(0, SHORT_ADDRESS_LEAD)}…${address.slice(-SHORT_ADDRESS_TAIL)}`;
}

/** The recipient as a heading: their name when there is one, else the address itself. */
export function payeeName(payee: PayeeDisplay): string {
  return payee.kind === 'handle' ? payee.name : shortAddress(payee.address);
}

/**
 * The recipient as one word inside a sentence — `@ian`, or the short address.
 *
 * Used where a sentence has to tell the payer to go back to this person ("ask @ian
 * for a new link"), so it reads as a person rather than as a paragraph about one.
 */
export function payeeLabel(payee: PayeeDisplay): string {
  return payee.kind === 'handle' ? `@${payee.handle}` : shortAddress(payee.address);
}
