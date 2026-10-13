import { Badge, Card, Text } from '@/components/ui';
import { shortenValue } from '@/components/receipt/receipt.format';
import { merchantVerification } from '@/lib/api/merchant-verification';
import type { HandleIdentity } from '@/lib/api';

export interface MerchantCardProps {
  /** The resolved handle being paid — the ONE identity shape, business or person. */
  merchant: HandleIdentity | null;
  /** True while the resolve request is in flight. */
  resolving?: boolean;
}

/**
 * Who is about to be paid, shown before any amount is committed.
 *
 * The name sits ABOVE the address it points at, never instead of it. A name is
 * something someone signed for; the address is the thing the money goes to, and
 * the only part that cannot be chosen — so a name whose address does not match
 * reads as a mismatch rather than as a label.
 *
 * The verification badge is drawn only from a flag the server sent. A missing
 * flag shows nothing: an absent answer is not a "yes".
 *
 * The unresolved branch is deliberately a card of the same shape rather than a
 * spinner alone: it keeps the layout from jumping when the merchant lands.
 */
export function MerchantCard({ merchant, resolving = false }: MerchantCardProps) {
  if (!merchant) {
    return (
      <Card>
        <Text variant="micro" as="p">
          {resolving ? 'Resolving merchant…' : 'No merchant selected.'}
        </Text>
      </Card>
    );
  }

  const verification = merchantVerification(merchant);

  return (
    <Card>
      <Text variant="card-title" as="p">
        {merchant.name}
      </Text>
      {merchant.address ? (
        <p className="mt-1 font-mono text-body-sm text-stone" title={merchant.address}>
          {shortenValue(merchant.address)}
        </p>
      ) : null}

      {verification === null ? null : (
        <div className="mt-2">
          <Badge variant={verification ? 'success' : 'warning'}>
            {verification ? 'Name verified' : 'Name not verified'}
          </Badge>
        </div>
      )}

      {merchant.category ? (
        <Text variant="micro" as="p" className="mt-2">
          {merchant.category}
        </Text>
      ) : null}

      {!merchant.address ? (
        <Text variant="micro" color="alert" as="p" className="mt-2">
          This merchant has no payout address yet, so it cannot be paid.
        </Text>
      ) : null}
    </Card>
  );
}
