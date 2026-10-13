import { Card, Text } from '@/components/ui';
import { MerchantIdentity } from './MerchantIdentity';
import { MerchantPayAction } from './MerchantPayAction';
import { PUBLIC_COPY } from './MerchantPublic.constants';
import type { MerchantPublicViewProps } from './MerchantPublic.types';

/**
 * The whole public merchant view: identity, then the one action.
 *
 * Nothing about any customer is here — this page is a merchant's, opened by
 * whoever holds the link, and the only thing it needs to say is who is being paid
 * and where the money goes.
 *
 * The pay action is only offered when there is a handle to carry: without one,
 * there is no link to resolve, and a Pay button that leads nowhere is worse than
 * none.
 */
export function MerchantPublicView({ merchant }: MerchantPublicViewProps) {
  return (
    <div className="space-y-6">
      <Text variant="micro" as="p" color="primary" className="font-brand text-heading-sm">
        {PUBLIC_COPY.brand}
      </Text>

      <Card className="space-y-6">
        <MerchantIdentity merchant={merchant} />

        {merchant.handle ? <MerchantPayAction handle={merchant.handle} /> : null}
      </Card>

      <Text variant="micro" as="p">
        {PUBLIC_COPY.moneyNote}
      </Text>
    </div>
  );
}
