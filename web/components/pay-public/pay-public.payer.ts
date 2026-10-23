import { chargeAmounts } from '@/lib/charges/charge-fee';
import { formatFiat } from '@/lib/formatCurrency';
import { PAYER_COPY } from './PayPublic.constants';
import { formatDay } from './pay-public.format';
import type { PayCharge } from '@/lib/charges/charge.types';
import type { PayerLink, PayerState, PayRequestValues } from './PayPayer.types';

/**
 * The payer's three states, as a URL and a set of answers.
 *
 * There is no detection here and none is possible: the page is served to a stranger
 * with no session and no wallet, and JavaScript is off. So the state is a DECLARATION
 * the payer makes in the query, and this module is the only place that reads it,
 * writes it, and turns it into the ways out. Every function is pure, which is why
 * `check-pay-states.mjs` can pin all of it without a browser.
 */

/** The key the payer uses to say which situation they are in. */
export const PAYER_PARAM = 'pay';

/**
 * Read the declaration.
 *
 * Anything unrecognised, absent, or supplied twice is the PAYING state: a link with a
 * hand-edited query must not be able to put a stranger on a page that refuses them,
 * and `?pay=<script>` must never reach a heading.
 */
export function resolvePayerState(raw: string | string[] | undefined): PayerState {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'empty' || value === 'none' ? value : 'wallet';
}

/**
 * The URL of a state.
 *
 * The paying state is written WITHOUT the key, so a bare `/pay/<id>` is the request
 * as it was sent and a declared state is visibly a declaration. It also means every
 * link this page already had keeps working.
 */
export function payerHref(id: string, payer: PayerState): string {
  return payer === 'wallet' ? `/pay/${id}` : `/pay/${id}?${PAYER_PARAM}=${payer}`;
}

/** Whether this payer is shown the request itself: the code, the link, the details. */
export function canSend(payer: PayerState): boolean {
  return payer !== 'none';
}

/**
 * The three values a payer needs to pay from a wallet that is not this browser.
 *
 * The AMOUNT is the total, not the principal: the total is what leaves the payer's
 * wallet, and printing the principal beside a copy control would be an invitation to
 * underpay by the fee. The REFERENCE is the charge id, because it is what says which
 * request a transfer answers; the merchant's own memo never leaves the page.
 */
export function payRequestValues(charge: PayCharge): PayRequestValues {
  const { total } = chargeAmounts(charge.amount, charge.currency);
  return {
    address: charge.recipientAddress,
    amount: formatFiat(total, charge.currency),
    reference: charge.id,
  };
}

/** The last day the request can be paid, as this page prints dates, or null. */
export function payDeadline(charge: PayCharge): string | null {
  return charge.expiresAt === null ? null : formatDay(charge.expiresAt);
}

/**
 * The ways out of a state, in the payer's own words.
 *
 * Every state can reach every other one, so no answer is a page with nothing on it:
 * a payer who said "no wallet" by mistake, or who got one an hour later, is one tap
 * from the request. These are plain links, so they work with JavaScript off.
 */
const LINKS: Record<PayerState, readonly { target: PayerState; label: string }[]> = {
  wallet: [
    { target: 'empty', label: PAYER_COPY.switchEmpty },
    { target: 'none', label: PAYER_COPY.switchNone },
  ],
  empty: [
    { target: 'wallet', label: PAYER_COPY.backToPaying },
    { target: 'none', label: PAYER_COPY.switchNone },
  ],
  none: [{ target: 'wallet', label: PAYER_COPY.backFromNone }],
};

export function payerLinks(id: string, payer: PayerState): PayerLink[] {
  return LINKS[payer].map(({ target, label }) => ({ label, href: payerHref(id, target) }));
}
