import { API_BASE_URL } from './api.constants';
import type { ClaimedMerchant } from './merchant-claim.types';

/**
 * The public identity behind a `seti.live/m/<handle>` link.
 *
 * This is the ONE read in the app that is deliberately unauthenticated: the
 * whole point of the link is that a customer can open it signed out and see who
 * they are about to pay before setting up anything. It hits
 * `/public/merchants/:handle`, which has no auth hook at all — see
 * `backend/src/routes/public-merchants.ts`.
 *
 * `null` means "no such handle" (a 404), which the page turns into `notFound()`.
 * Any other failure is thrown and becomes a real error, never a fake 404: a
 * backend that is down must not read to a stranger as "this merchant does not
 * exist".
 */
export async function fetchPublicMerchant(handle: string): Promise<ClaimedMerchant | null> {
  const response = await fetch(`${API_BASE_URL}/public/merchants/${encodeURIComponent(handle)}`, {
    // The identity is live: a name can be claimed or its address repointed, so
    // this is never served from Next's cache.
    cache: 'no-store',
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Could not load this merchant (${response.status}).`);
  }

  const { merchant } = (await response.json()) as { merchant: ClaimedMerchant };
  return merchant;
}
