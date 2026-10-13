import { Badge } from '@/components/ui';
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
 * The verification badge is drawn only from the flag the server sent (recomputed
 * from the stored signature); a missing flag shows nothing, because an absent
 * answer is not a "yes".
 */
export function SendResolvedRecipient({ recipient }: SendResolvedRecipientProps) {
  const verification = merchantVerification(recipient);

  return (
    <div className="rounded-md border border-hairline-dark p-3">
      <p className="text-caption text-on-dark-mute">{SEND_RESOLVED_COPY.label}</p>
      <p className="mt-1 text-body-sm text-on-dark">{recipient.name}</p>

      {recipient.address ? (
        <p
          className="mt-1 break-all font-mono text-caption text-on-dark"
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
