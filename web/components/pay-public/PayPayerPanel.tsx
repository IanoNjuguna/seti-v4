import { Text } from '@/components/ui';
import { buildChargeUri } from '@/lib/charges/charge-uri';
import { PAYER_COPY } from './PayPublic.constants';
import { canSend, payDeadline, payerLinks, payRequestValues } from './pay-public.payer';
import { qrTitle } from './pay-public.step';
import { PayFundFirst } from './PayFundFirst';
import { PayPayerBlocked } from './PayPayerBlocked';
import { PayPayerSwitch } from './PayPayerSwitch';
import { PayQrPanel } from './PayQrPanel';
import { PayRequestDiy } from './PayRequestDiy';
import type { PayPayerPanelProps } from './PayPayer.types';

/**
 * "Can I pay this, and how": the section a stranger needs and the page never had.
 *
 * The order is the argument. What paying NEEDS comes first and is the same in all
 * three states, because it is the question the page is answering. Then the payer's
 * own situation. Then, only where a payment is possible, the request itself: the
 * code, the deep link for a wallet that understands it, and the three values that
 * work in any other wallet. What is never drawn is a payment prompt for someone who
 * said they have no wallet to pay from.
 *
 * Which state draws is decided by `pay-public.payer.ts` from the URL, not here.
 */
export function PayPayerPanel({ charge, payee, payer }: PayPayerPanelProps) {
  const openUntil = payDeadline(charge);

  return (
    <section className="space-y-4" aria-labelledby="pay-how">
      <Text variant="micro" as="h2" id="pay-how">
        {PAYER_COPY.section}
      </Text>
      <Text variant="body" color="secondary" as="p">
        {PAYER_COPY.need}
      </Text>

      {payer === 'empty' ? <PayFundFirst openUntil={openUntil} /> : null}

      {canSend(payer) ? (
        <>
          <PayQrPanel uri={buildChargeUri(charge.id)} title={qrTitle(charge, payee)} />
          <PayRequestDiy values={payRequestValues(charge)} />
        </>
      ) : (
        <PayPayerBlocked openUntil={openUntil} />
      )}

      <PayPayerSwitch links={payerLinks(charge.id, payer)} />
    </section>
  );
}
