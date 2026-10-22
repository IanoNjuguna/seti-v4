import type { ReferralJoin } from '@/lib/api';

/**
 * What the invite screen can be showing, as one value rather than three booleans.
 *
 * The three states that are NOT "here is your link" are the ones that matter, and
 * each has its own reason, so each is its own case:
 *
 *  - `loading`   — the read is in flight. A skeleton, never a link that may be wrong.
 *  - `error`     — the read failed. The sentence is ours (see `ApiError`); a screen
 *                  that showed an empty invite for a failed request would claim the
 *                  account has invited nobody, which is a different fact.
 *  - `no-name`   — the account holds no username, so there is no link to give out.
 *  - `not-live`  — the username exists but resolves to nobody (parked for brand
 *                  review), so a link would open and attribute nobody.
 *  - `live`      — the link, the count, and who joined.
 */
export type InviteView =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'no-name' }
  | { kind: 'not-live' }
  | { kind: 'live'; link: string; count: number; joined: ReferralJoin[] };

export interface UseInviteReturn {
  view: InviteView;
}

/** What the one field in the screen is: a value, what to call it, what it says. */
export interface InviteLinkFieldProps {
  value: string;
}

/** The count as a sentence. */
export interface InviteJoinedProps {
  count: number;
  joined: ReferralJoin[];
}

/** A state with no link in it: a heading, one sentence, and sometimes an action. */
export interface InviteEmptyStateProps {
  title: string;
  body: string;
}
