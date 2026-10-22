import { Text } from '@/components/ui';
import { PAY_COPY } from './PayPublic.constants';
import { PayRecipientAddress } from './PayRecipientAddress';
import { PayRecipientNamed } from './PayRecipientNamed';
import type { PayRecipientProps } from './PayPublic.types';

/**
 * Who is being paid, in the three states the server can resolve.
 *
 * The two halves are separate files because they are different READINGS, not two
 * branches of one: a named recipient is "this person, and here is where the money
 * goes", an unnamed one is "this address, and it has no name". Keeping them in one file
 * invites a shared layout that flattens the distinction — which is exactly the bug that
 * turns "not a Seti name" into a name-shaped heading.
 *
 * All three display states are decided in `resolve-payee.ts` on the server. Nothing
 * here reads a query parameter: a payer cannot put a name on this page.
 */
export function PayRecipient({ payee }: PayRecipientProps) {
  return (
    <div>
      <Text variant="micro" as="p">
        {PAY_COPY.payeeEyebrow}
      </Text>

      {payee.kind === 'handle' ? (
        <PayRecipientNamed payee={payee} />
      ) : (
        <PayRecipientAddress address={payee.address} />
      )}
    </div>
  );
}
