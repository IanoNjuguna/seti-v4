import { Badge, Text } from '@/components/ui';
import { shortenValue } from '@/components/receipt/receipt.format';
import { merchantVerification } from '@/lib/api/merchant-verification';
import { PUBLIC_COPY } from './MerchantPublic.constants';
import type { MerchantIdentityProps } from './MerchantPublic.types';

/**
 * Who the customer is about to pay: the name, its verification state, and the
 * address underneath.
 *
 * The address is the authoritative thing and the name is only a label, so they
 * appear together and in that order — the shortened form for reading, the FULL
 * address in `title` so a suspicious customer can check every character. The
 * verification badge is drawn only from the flag the server sent (`verified`,
 * recomputed from the stored signature); a missing flag shows nothing, because
 * an absent answer is not a "yes".
 */
export function MerchantIdentity({ merchant }: MerchantIdentityProps) {
  const verification = merchantVerification(merchant);

  return (
    <div>
      <Text variant="micro" as="p">
        {merchant.category ?? PUBLIC_COPY.eyebrow}
      </Text>

      <Text variant="section" as="h1" className="mt-1">
        {merchant.name}
      </Text>

      {merchant.address ? (
        <p className="mt-2 font-mono text-body-sm text-stone" title={merchant.address}>
          {shortenValue(merchant.address)}
        </p>
      ) : (
        <Text variant="micro" as="p" className="mt-2">
          {PUBLIC_COPY.noAddress}
        </Text>
      )}

      {verification === null ? null : (
        <div className="mt-3">
          <Badge variant={verification ? 'success' : 'warning'}>
            {verification ? PUBLIC_COPY.verified : PUBLIC_COPY.unverified}
          </Badge>
        </div>
      )}
    </div>
  );
}
