import { Badge, Text } from '@/components/ui';
import { shortenValue } from '@/components/receipt/receipt.format';
import { merchantVerification } from '@/lib/api/merchant-verification';
import { SEND_RESOLVED_COPY } from './SendPanel.constants';
import type { SendResolvedRecipientProps } from './SendPanel.types';

/**
 * Who the customer is sending to, once a username has been RESOLVED.
 *
 * The name and the address are shown TOGETHER and before anything is signed: the
 * username is only how the customer found the person, and the address is what the
 * wallet will actually sign. The shortened form is for reading, the FULL address
 * sits in `title` so a suspicious customer can check every character — the same
 * contract the pay screen's `MerchantCard` and the public pages use.
 *
 * The name is `card-title` (16/600) and the label above it is `micro`, so
 * the block reads as label → person → address rather than as three grey lines of
 * the same weight. It used to be 13px label, 14px name, 13px address: the name of
 * the person you are about to pay was the *middle* size on the screen, level with
 * its own caption. This is the block that stops a wrong-person send, so it is the
 * clearest thing on the step. It is drawn on `canvas-light` with the rest of the
 * amount step, so its hairline is the light one and its text takes the ink roles.
 *
 * The verification badge is drawn only from the flag the server sent (recomputed
 * from the stored signature); a missing flag shows nothing, because an absent
 * answer is not a "yes".
 */
export function SendResolvedRecipient({ recipient }: SendResolvedRecipientProps) {
  const verification = merchantVerification(recipient);

  return (
    <div className="rounded-md border border-hairline-light p-3">
      <Text variant="micro" as="p" color="secondary">
        {SEND_RESOLVED_COPY.label}
      </Text>
      <Text variant="card-title" as="p" className="mt-1">
        {recipient.name}
      </Text>

      {recipient.address ? (
        <p
          className="mt-1 break-all font-mono text-caption text-ink"
          title={recipient.address}
        >
          {shortenValue(recipient.address)}
        </p>
      ) : null}

      {verification === null ? null : (
        <div className="mt-2">
          <Badge variant={verification ? 'success' : 'warning'}>
            {verification ? SEND_RESOLVED_COPY.verified : SEND_RESOLVED_COPY.unverified}
          </Badge>
        </div>
      )}
    </div>
  );
}
