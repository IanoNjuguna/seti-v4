import { Badge, Text } from '@/components/ui';
import { PAY_COPY } from './PayPublic.constants';
import type { PayeeIdentity } from './PayPublic.types';

interface PayRecipientVerifiedProps {
  identity: PayeeIdentity;
}

/**
 * A merchant Seti has reviewed: the name, and the mark that says so.
 *
 * The ADDRESS is still here, under the name, in mono, with the full string in `title`.
 * A page that showed only the name would ask someone to trust a string they cannot check,
 * and the address is the only thing on this page the money actually follows. The mark is
 * not the whole message either: it sits above one sentence saying what was checked, so the
 * claim survives greyscale, a screenshot and a screen reader.
 *
 * What is NOT here, deliberately: any wording about Seti holding, moving or refunding the
 * money. Reviewing a merchant says who they are. It does not say Seti pays them.
 */
export function PayRecipientVerified({ identity }: PayRecipientVerifiedProps) {
  return (
    <>
      <Text variant="section" as="h2" className="mt-1">
        {identity.heading}
      </Text>

      {identity.handle === null ? null : (
        <p className="mt-1 font-mono text-body-sm text-mute">@{identity.handle}</p>
      )}

      <p className="mt-1 font-mono text-body-sm text-charcoal" title={identity.fullAddress}>
        {identity.address}
      </p>

      <div className="mt-3 space-y-2">
        <Badge variant="success">{PAY_COPY.verifiedBadge}</Badge>
        <Text variant="micro" as="p">
          {PAY_COPY.verifiedNote}
        </Text>
      </div>
    </>
  );
}
