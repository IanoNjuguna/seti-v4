'use client';

import { Text } from '@/components/ui';
import { ClaimRow } from './ClaimRow';
import { CLAIMS_COPY } from './Claims.constants';
import { useClaims } from './useClaims';

/**
 * The claims this account sent, above the ledger (#465).
 *
 * It renders NOTHING when there is nothing to show, and that is the whole design decision: an empty
 * "Claims" band on every account's history is a permanent advertisement for a feature most customers
 * will never use, and the entry point for making one is on Receive where it belongs.
 *
 * A claim is not a transaction. Nothing has moved, the money is still the payer's, so these rows sit in
 * their own band with their own word for each state, above the day groups rather than inside them. The
 * day a claim is paid it appears in the ledger as the payment it became, which is the evidence; the
 * claim row then reads `Paid` and stops asking for anything.
 */
export function ClaimsSection() {
  const { claims, loading, error, withdrawing, withdraw } = useClaims();

  if (loading) return null;
  if (error === 'load') {
    return (
      <Text variant="micro" as="p" color="secondary">
        {CLAIMS_COPY.loadFailed}
      </Text>
    );
  }
  if (claims.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <Text variant="section" as="h3">
        {CLAIMS_COPY.title}
      </Text>

      <ul className="flex flex-col">
        {claims.map((claim) => (
          <ClaimRow
            key={claim.publicId}
            claim={claim}
            withdrawing={withdrawing === claim.publicId}
            onWithdraw={withdraw}
          />
        ))}
      </ul>

      {error === 'withdraw' ? (
        <Text variant="micro" as="p" color="alert">
          {CLAIMS_COPY.withdrawFailed}
        </Text>
      ) : null}
    </section>
  );
}
