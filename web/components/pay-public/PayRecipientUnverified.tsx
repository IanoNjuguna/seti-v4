import { Badge, Text } from '@/components/ui';
import { PAY_COPY, PAY_LINK_CLASS, reportNameMailto } from './PayPublic.constants';
import type { PayeeIdentity } from './PayPublic.types';

interface PayRecipientUnverifiedProps {
  identity: PayeeIdentity;
}

/**
 * Everyone else: a handle, or an address, and no name Seti has reviewed.
 *
 * The name is the tier's currency, so it is not drawn here. A claim whose signature no
 * longer holds loses its name and keeps its handle; an address with no claim keeps the
 * address. Both are labelled with what they are rather than dressed as something better.
 *
 * A raw `<p>`/`<h2>` rather than the `Text` primitive for the address heading, for the
 * same reason the person and merchant pages do it: the identity of an unnamed payee is a
 * mono string, and `Text`'s variants set a family of their own that a `font-mono` class
 * cannot reliably beat (both are joined, so Tailwind's emission order decides).
 *
 * The report link is the only recourse on a page where money is at stake (#148 removed
 * the held-brand queue, so a name goes live and payable the moment it verifies). It is
 * drawn when there IS a name to report: a stranger's address has nothing to report but the
 * address, and the sentence above already tells the payer where the money goes.
 */
export function PayRecipientUnverified({ identity }: PayRecipientUnverifiedProps) {
  return (
    <>
      <h2
        className={
          identity.headingIsAddress
            ? 'mt-1 font-mono text-heading-sm font-medium text-ink'
            : 'mt-1 text-heading-sm font-medium text-ink'
        }
        title={identity.fullAddress}
      >
        {identity.heading}
      </h2>

      {identity.showAddressLine ? (
        <p className="mt-1 font-mono text-body-sm text-charcoal" title={identity.fullAddress}>
          {identity.address}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        <Badge variant="neutral">{PAY_COPY.unverifiedBadge}</Badge>
        <Text variant="micro" as="p">
          {PAY_COPY.unverifiedNote}
        </Text>
        {identity.noName ? (
          <Text variant="micro" as="p">
            {PAY_COPY.noNameNote}
          </Text>
        ) : null}
        {identity.handle === null ? null : (
          <a href={reportNameMailto(identity.handle)} className={PAY_LINK_CLASS}>
            {PAY_COPY.reportName}
          </a>
        )}
      </div>
    </>
  );
}
