/**
 * Every word the profile's Invite row renders, one per state.
 *
 * Two states, not three: a claimed name is live the moment it verifies (#148), so
 * there is no "waiting for review" copy left to write. What the row says about a
 * name that pays is what a link is FOR, which is the same sentence whatever the
 * account's history.
 */
export const PROFILE_INVITE_COPY = {
  title: 'Invite friends',
  /** Under the title, once there is a link to offer: what the link does. */
  intro: 'Send your link to someone. When they sign up, their name appears here.',

  /** No username at all: there is no link, and this is what makes one possible. */
  noNameBody: 'Create your username first.',
  noNameAction: 'Create your username',
} as const;
