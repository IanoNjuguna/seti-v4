import { get } from './client';
import type { ReferralSummary } from './referrals.types';

/**
 * Who joined on this account's invite link.
 *
 * One read, and it carries everything the invite screen draws: the link to hand
 * out, the count as a number, and the handles that arrived. The count is a number
 * rather than a formatted sentence because the SENTENCE is the screen's copy (see
 * `Invite.constants.ts`), and a server that phrased it would be a second place to
 * change how many people joined.
 *
 * `handle` and `link` are `null` for an account with no live username: inviting
 * requires a name, because the link has to point at an account that exists.
 */
export async function fetchMyReferrals(): Promise<ReferralSummary> {
  return get<ReferralSummary>('/referrals/me');
}
