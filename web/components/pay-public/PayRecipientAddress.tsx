import { Badge, Text } from '@/components/ui';
import { PAY_COPY } from './PayPublic.constants';
import { shortAddress } from './pay-public.format';

interface PayRecipientAddressProps {
  address: string;
}

/**
 * No name for this address, so the address IS the identity.
 *
 * Shortened to be read, labelled so nobody mistakes the absence of a name for
 * something else — "not a Seti name" is a fact about the address, not a judgement
 * about the person — and never dressed up as a name the address has not got. The full
 * address sits in `title` and in the HTML.
 *
 * A raw `<p>`/`<h2>` here rather than the `Text` primitive, for the same reason the
 * person and merchant pages do it: the identity of an unnamed payee is a mono string,
 * and `Text`'s variants set a family of their own that a `font-mono` class cannot
 * reliably beat (both are joined, so Tailwind's emission order decides).
 */
export function PayRecipientAddress({ address }: PayRecipientAddressProps) {
  return (
    <>
      <h2 className="mt-1 font-mono text-heading-sm font-medium text-ink" title={address}>
        {shortAddress(address)}
      </h2>

      <div className="mt-3 space-y-2">
        <Badge variant="neutral">{PAY_COPY.noName}</Badge>
        <Text variant="micro" as="p">
          {PAY_COPY.noNameNote}
        </Text>
      </div>
    </>
  );
}
