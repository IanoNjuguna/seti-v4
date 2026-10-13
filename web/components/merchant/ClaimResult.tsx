'use client';

import { Badge, Button, Card, Text } from '@/components/ui';
import { shortenValue } from '@/components/receipt/receipt.format';
import { merchantLink } from '@/lib/merchant-link';
import { CLAIM_COPY } from './Claim.constants';
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
 * address. The QR encodes the same `merchantLink` the text shows.
 */
export function ClaimResult({ claimed, onAgain }: ClaimResultProps) {
  const link = claimed.handle ? merchantLink(claimed.name) : null;

  return (
    <Card className="space-y-4">
      <div>
        <Text variant="micro" as="p">
          {CLAIM_COPY.resultTitle}
        </Text>
        <Text variant="section" as="p" className="mt-1">
          {claimed.name}
        </Text>
        {claimed.payoutAddress ? (
          <p className="mt-1 font-mono text-body-sm text-stone" title={claimed.payoutAddress}>
            {shortenValue(claimed.payoutAddress)}
          </p>
        ) : null}
      </div>

      <Badge variant={claimed.verified ? 'success' : 'warning'}>
        {claimed.verified ? CLAIM_COPY.verified : CLAIM_COPY.unverified}
      </Badge>

      {claimed.verified && link ? (
        <div className="space-y-3">
          <div>
            <Text variant="micro" as="p">
              {CLAIM_COPY.linkLabel}
            </Text>
            <p className="mt-1 break-all font-mono text-body-sm text-ink">{link}</p>
          </div>

          <MerchantQr name={claimed.name} />
        </div>
      ) : null}

      <Button variant="secondary" onClick={onAgain} fullWidth>
        {CLAIM_COPY.again}
      </Button>
    </Card>
  );
}
