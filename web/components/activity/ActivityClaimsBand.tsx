import { Text } from '@/components/ui';
import { ClaimRow } from './ClaimRow';
import { CLAIMS_COPY } from './ActivityClaims.constants';
import type { ActivityClaimsBandProps } from './ActivityClaims.types';

/**
 * The claims band: what a customer is waiting on, above the ledger that says what happened (#465).
 *
 * It renders NOTHING when there is nothing to show, and that absence is deliberate: an empty
 * "Claims" heading on an account that never asked for money is a section announcing a feature
 * rather than a fact, and the ledger below is the page's subject.
 *
 * A real `<section>` with an accessible name, and `section`-grade heading, so it reads as a band
 * of the same rank as the ledger's own (`ActivityBand`), not as an aside.
 *
 * The trailing edge of the last row is suppressed, the same call the day groups make: a separator
 * belongs between two rows, never after the last one.
 */
export function ActivityClaimsBand({ rows, cancelling, error, onCancel }: ActivityClaimsBandProps) {
  if (rows.length === 0 && !error) return null;

  return (
    <section aria-label={CLAIMS_COPY.sectionLabel} className="flex flex-col gap-4">
      <Text variant="section" as="h2">
        {CLAIMS_COPY.label}
      </Text>

      {rows.length > 0 ? (
        <ul className="[&>li:last-child>*]:border-b-0">
          {rows.map((claim) => (
            <li key={claim.publicId}>
              <ClaimRow claim={claim} cancelling={cancelling === claim.publicId} onCancel={onCancel} />
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <Text variant="micro" as="p" color="secondary" role="alert">
          {error}
        </Text>
      ) : null}
    </section>
  );
}
