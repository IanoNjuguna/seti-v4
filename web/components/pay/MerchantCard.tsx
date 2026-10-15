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
 * reads as a mismatch rather than as a label. The name is `card-title` (16/600)
 * and the address is mono `caption` (13px): the same two levels the transaction
 * rows use, so an identity reads identically everywhere it appears.
 *
 * The verification badge — or its absence — is the only thing allowed to be
 * third: a person sees the name, the address, and then whether the name is bound
 * to that address. A missing flag shows nothing, because an absent answer is not
 * a "yes".
 *
 * The unresolved branch is a card of the SAME shape and roughly the same height
 * rather than a spinner alone: three skeleton bars where the name, the address
 * and the badge land, so the layout does not jump when the merchant arrives. It
 * used to be one line of 14px grey text in a 32px-padded card, which moved
 * everything below it by ~90px at the moment of resolution.
 */
export function MerchantCard({ merchant, resolving = false }: MerchantCardProps) {
  if (!merchant) {
    return (
      <Card aria-busy={resolving}>
        {resolving ? (
          <>
            <span className="block h-4 w-40 rounded-sm bg-surface-soft" />
            <span className="mt-2 block h-3 w-32 rounded-sm bg-surface-soft" />
            <span className="mt-3 block h-6 w-28 rounded-sm bg-surface-soft" />
            <Text variant="micro" as="p" color="secondary" className="mt-3">
              Finding that merchant…
            </Text>
          </>
        ) : (
          <Text variant="micro" as="p" color="secondary">
            No merchant chosen yet.
          </Text>
        )}
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
        <p className="mt-1 font-mono text-caption text-stone" title={merchant.address}>
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
        <Text variant="micro" as="p" color="secondary" className="mt-2">
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
