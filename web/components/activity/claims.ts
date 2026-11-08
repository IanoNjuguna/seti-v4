import { formatFiat } from '@/lib/formatCurrency';
import { CLAIMS_COPY } from './ActivityClaims.constants';
import type { ClaimRowModel, ClaimSummaries } from './ActivityClaims.types';

/** `12 Nov` — the row's own locale, called after the fetch, never during SSR. */
function formatShared(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

/**
 * Which claims the band shows, and how each one reads (#465).
 *
 * A SETTLED claim is dropped, not shown as `Paid`: the payment that closed it is already a row in
 * the ledger below, with its own receipt, and printing both would put one event on the screen
 * twice. Every other state is kept, because each of them is a claim the customer can no longer
 * pay and would otherwise watch disappear: `open` is the one being waited on, `expired` lapsed
 * without anybody writing it, and `cancelled` is one they withdrew.
 *
 * The selection is here rather than in the component so `check:claim-band` can assert it without
 * a session: a rule about money that can only be checked by looking at a screen is a rule that
 * gets broken by the next person who moves a filter.
 */
export function claimRows(claims: ClaimSummaries): ClaimRowModel[] {
  return claims
    .filter((claim) => claim.status !== 'settled')
    .map((claim) => ({
      publicId: claim.publicId,
      title: claim.memo.trim() || CLAIMS_COPY.titleFallback,
      subtitle: CLAIMS_COPY.subtitle(formatShared(claim.createdAt), claim.destinationHandle),
      amount: formatFiat(Number(claim.amount), claim.currency),
      state: claim.status,
      stateWord: CLAIMS_COPY.states[claim.status],
      cancellable: claim.status === 'open',
    }));
}
