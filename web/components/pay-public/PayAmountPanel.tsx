import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { PAY_COPY } from './PayPublic.constants';
import type { PayAmountPanelProps } from './PayPublic.types';

/**
 * The figure this whole page exists for.
 *
 * It is the PRINCIPAL — what the recipient is owed — because that is the number the
 * payer and the recipient agreed on, and the fee is explained below rather than baked
 * into the headline. A page that led with the total would make Seti's 2% part of the
 * price before anyone had agreed to it.
 *
 * Mono and tabular (`variant="balance"` plus `tabular`), so the digits line up and the
 * currency code cannot be mistaken for a symbol from another market.
 *
 * The memo sits underneath without a label of its own: "For October rent" reads as the
 * reference the payer already knows, and a heading over three words is noise.
 */
export function PayAmountPanel({ currency, amount, memo }: PayAmountPanelProps) {
  return (
    <div>
      <Text variant="micro" as="p">
        {PAY_COPY.eyebrow}
      </Text>

      <Text variant="balance" as="p" tabular className="mt-1">
        {formatFiat(amount, currency)}
      </Text>

      {memo === null ? null : (
        <Text variant="micro" as="p" className="mt-1">
          For {memo}
        </Text>
      )}
    </div>
  );
}
