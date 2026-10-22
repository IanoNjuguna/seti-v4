import { Badge, Text } from '@/components/ui';
import type { NamedPayee } from '@/lib/charges/charge.types';
import { PAY_COPY } from './PayPublic.constants';
import { shortAddress } from './pay-public.format';

interface PayRecipientNamedProps {
  payee: NamedPayee;
}

/**
 * A recipient Seti has a name for.
 *
 * The ADDRESS is always here, under the name, in mono: the name is a label the payer
 * recognises and the address is where the money goes, and a page that showed only the
 * name would be asking someone to trust a string the sender of the link could have
 * chosen. `title` carries the full address so it can be checked character by character.
 *
 * "Named" and "checked" are drawn separately on purpose — a name Seti has not verified
 * is still a name, and saying so is not the same as hiding it.
 */
export function PayRecipientNamed({ payee }: PayRecipientNamedProps) {
  return (
    <>
      <Text variant="section" as="h2" className="mt-1">
        {payee.name}
      </Text>

      <p className="mt-1 font-mono text-body-sm text-mute">@{payee.handle}</p>
      <p className="mt-1 font-mono text-body-sm text-stone" title={payee.address}>
        {shortAddress(payee.address)}
      </p>

      <div className="mt-3 space-y-2">
        <Badge variant={payee.verified ? 'success' : 'warning'}>
          {payee.verified ? PAY_COPY.verified : PAY_COPY.unverified}
        </Badge>
        {payee.verified ? null : (
          <Text variant="micro" as="p">
            {PAY_COPY.unverifiedNote}
          </Text>
        )}
      </div>
    </>
  );
}
