'use client';

import { ActivityClaimsBand } from './ActivityClaimsBand';
import { useClaims } from './useClaims';

/**
 * The claims band on Activity, with its read attached (#465).
 *
 * Two files rather than one: the band is pure and fixtures render it (`check:claim-band`), and
 * this is the only part that knows a session exists. Nothing renders until the read answers —
 * a heading that appears before the data is a heading that lies about an empty account.
 */
export function ActivityClaims() {
  const claims = useClaims();

  if (claims.rows === null) return null;

  return (
    <ActivityClaimsBand
      rows={claims.rows}
      cancelling={claims.cancelling}
      error={claims.error}
      onCancel={claims.cancel}
    />
  );
}
