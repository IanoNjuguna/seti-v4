/** What an account may know about the people it invited. Mirrors `ReferralSummary`. */
export interface ReferralJoin {
  /** The invitee's live username, or `null` when they have not claimed one yet. */
  handle: string | null;
  /** ISO timestamp of the moment the account was established. */
  joinedAt: string;
}

/**
 * The invite screen's whole payload, and therefore the whole of what a referrer
 * can learn about an invitee: a handle and a time.
 *
 * There is deliberately no email, no address, no amount and no account id here.
 * The shape is the privacy boundary, so nothing is added to it without saying, in
 * the privacy policy, that a referrer can see it.
 */
export interface ReferralSummary {
  /** The caller's live username, or `null` when they hold none. */
  handle: string | null;
  /** The invite link to hand out, or `null` for the same reason. */
  link: string | null;
  /** How many accounts arrived on this account's invites. */
  count: number;
  /** Who joined, newest first. */
  joined: ReferralJoin[];
}
