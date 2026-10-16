'use client';

import { Badge, Button, Card, Text } from '@/components/ui';
import { shortenValue } from '@/components/receipt/receipt.format';
import { handleLink } from '@/lib/merchant-link';
import { claimCopy } from './Claim.constants';
import { MerchantQr } from './MerchantQr';
import type { ClaimResultProps } from './ClaimForm.types';

/**
 * The claimed name, with its address UNDERNEATH and the verification state
 * spelled out.
 *
 * The address is the authoritative thing and the name is a label, so they are
 * shown together and in that order: a customer reading this can see exactly which
 * address the name points at. `verified` comes from the backend, which re-derived
 * it from the stored signature — this component never decides it.
 *
 * The link and the QR are shown only once the binding verifies: an unverified
 * name resolves to nothing, so printing its link would be printing a broken
 * address. Both are built from the claimed KIND — `/u/<handle>` for a person,
 * `/m/<handle>` for a business — because a username handed a `/m/` link would send
 * a customer to a shop page for someone who is not a shop.
 */
export function ClaimResult({ claimed, onAgain }: ClaimResultProps) {
  const words = claimCopy(claimed.kind);
  const review = claimed.review;
  // A parked claim is NOT live — no link, no QR — whatever its signature.
  const live = claimed.verified && review === null;
  const link = claimed.handle ? handleLink(claimed.kind, claimed.name) : null;

  return (
    <Card className="space-y-4">
      <div>
        <Text variant="micro" as="p" color="secondary">
          {words.resultTitle}
        </Text>
        <Text variant="section" as="p" className="mt-1">
          {claimed.name}
        </Text>
        {claimed.address ? (
          <p className="mt-1 break-all font-mono text-caption text-stone" title={claimed.address}>
            {shortenValue(claimed.address)}
          </p>
        ) : null}
      </div>

      {review ? (
        <div className="space-y-2">
          <Badge variant="neutral">{words.underReview}</Badge>
          <Text variant="body" color="secondary" as="p">
            {review.message}
          </Text>
        </div>
      ) : (
        <Badge variant={claimed.verified ? 'success' : 'warning'}>
          {claimed.verified ? words.verified : words.unverified}
        </Badge>
      )}

      {live && link ? (
        <div className="space-y-3">
          <div>
            <Text variant="micro" as="p" color="secondary">
              {words.linkLabel}
            </Text>
            <p className="mt-1 break-all font-mono text-body-sm text-ink">{link}</p>
          </div>

          <MerchantQr name={claimed.name} kind={claimed.kind} />
        </div>
      ) : null}

      <Button variant="secondary" onClick={onAgain} fullWidth>
        {words.again}
      </Button>
    </Card>
  );
}
