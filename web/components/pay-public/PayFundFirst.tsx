import { Text } from '@/components/ui';
import { PAYER_COPY } from './PayPublic.constants';
import type { PayFundFirstProps } from './PayPayer.types';

/**
 * A wallet with nothing in it that can send this.
 *
 * This is the state #153 exists to stop: a page that shows a code to someone whose
 * wallet is empty looks broken at the moment they were willing to pay. So the truth
 * comes first, then the only two things that change it (dollars arrive, the link is
 * opened again), then the two near-misses a payer will otherwise argue with: the
 * wrong coin, and dollars on the wrong network.
 *
 * The code and the details are still drawn below, deliberately. They are what the
 * payer comes back to the moment the wallet is funded, and hiding them would mean a
 * second visit spent looking for them again.
 */
export function PayFundFirst({ openUntil }: PayFundFirstProps) {
  return (
    <div className="space-y-2">
      <Text variant="body" as="p">
        {PAYER_COPY.emptyLine}
      </Text>
      <Text variant="micro" as="p">
        {PAYER_COPY.emptyNext}
      </Text>
      <Text variant="micro" as="p">
        {PAYER_COPY.emptyOther}
      </Text>
      <Text variant="micro" as="p">
        {PAYER_COPY.stayOpen(openUntil)}
      </Text>
    </div>
  );
}
