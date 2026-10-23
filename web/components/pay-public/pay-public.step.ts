import { formatFiat } from '@/lib/formatCurrency';
import { chargeAmounts } from '@/lib/charges/charge-fee';
import type { ChargeStatus, PayCharge, PayeeDisplay } from '@/lib/charges/charge.types';
import { PLATFORM_FEE_PERCENT } from '@/lib/charges/charge.constants';
import { formatDay, payeeLabel } from './pay-public.format';
import { payeeIdentity } from './pay-public.tier';
import type { PayerState } from './PayPayer.types';

/**
 * The one sentence each state owes the payer.
 *
 * Written per state rather than assembled from fragments, because the difference
 * between these states is exactly what the payer must do next: pay, keep the receipt,
 * ask for the difference, ask for the extra back, ask for a new link. A shared
 * template would flatten them into one voice and lose the instruction.
 *
 * `pending` also depends on the PAYER (#153): the sentence invites a scan only when
 * the payer has a wallet to scan with, and says the wallet is empty or missing when
 * they have declared that instead. The status is still the same status; what changes
 * is whether the instruction can be followed. The detail behind each is in
 * `PayPayerPanel`, so nothing is said twice.
 *
 * Every figure is the charge's own, formatted in the charge's currency. Nothing here
 * computes an amount that could be paid — the numbers printed are the numbers stored.
 */
export function statusStep(
  status: ChargeStatus,
  charge: PayCharge,
  payee: PayeeDisplay,
  payer: PayerState
): string {
  const { currency } = charge;
  const { total } = chargeAmounts(charge.amount, currency);
  const who = payeeLabel(payee);

  switch (status) {
    case 'pending':
      if (payer === 'none') return 'You cannot pay this request. Nothing has left your wallet.';
      if (payer === 'empty') {
        return (
          `Your wallet needs dollars before it can send ${formatFiat(total, currency)}. ` +
          'Nothing has left your wallet.'
        );
      }
      return (
        `Scan the code below with the Seti app to pay ${formatFiat(total, currency)}. ` +
        'Nothing leaves your wallet until you confirm it there.'
      );
    case 'paid':
      return 'The money arrived. Seti keeps a receipt for it.';
    case 'underpaid':
      return (
        `${formatFiat(charge.received, currency)} of ${formatFiat(total, currency)} has arrived. ` +
        `Don’t send the full amount again — ask ${who} for a new request for the difference.`
      );
    case 'overpaid':
      return (
        `${formatFiat(charge.received, currency)} arrived against ${formatFiat(total, currency)}. ` +
        `Ask ${who} to send the extra back.`
      );
    case 'expired':
      return (
        `This request expired on ${formatExpiry(charge)} and cannot be paid. ` +
        `Nothing was charged — ask ${who} for a new link.`
      );
  }
}

/** An expired charge always has a deadline; the fallback is only a type guard. */
function formatExpiry(charge: PayCharge): string {
  return charge.expiresAt === null ? 'its deadline' : formatDay(charge.expiresAt);
}

/**
 * The line under the fee rows.
 *
 * It says the thing a payer is entitled to know before signing: the fee is added to
 * what they send, so the recipient still receives the whole amount. The alternative
 * wording — "2% is charged to the recipient" — is also true of the ledger and reads
 * as the opposite of what happens to their money.
 */
export function feeNote(charge: PayCharge, payee: PayeeDisplay): string {
  // The recipient is named by the TIER's own vocabulary (#154). A merchant Seti has
  // reviewed gets its name; everyone else gets the handle or the address, so a name can
  // never reach a payer through this sentence on a page that would not draw it above.
  return (
    `The ${PLATFORM_FEE_PERCENT}% is Seti’s fee, added to what you pay. ` +
    `${payeeIdentity(payee).heading} receives the full ${formatFiat(charge.amount, charge.currency)}.`
  );
}

/** The code's accessible name: a code can carry a link, an address or a request. */
export function qrTitle(charge: PayCharge, payee: PayeeDisplay): string {
  const { total } = chargeAmounts(charge.amount, charge.currency);
  return `Payment request for ${formatFiat(total, charge.currency)} to ${payeeIdentity(payee).heading}`;
}
