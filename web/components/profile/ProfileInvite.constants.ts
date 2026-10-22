/**
 * Every word the profile's Invite row renders, one per state.
 *
 * The states are the invite SCREEN's states (`InviteView`), read through the one
 * hook, so the row and the screen cannot disagree about whether a link exists. None
 * of them names a cause the backend has stopped exposing: `#148` removed the
 * brand-review queue, so "not live" is now stated as the fact it is — a link that
 * does not open yet — rather than as a review an account is waiting on.
 */
export const PROFILE_INVITE_COPY = {
  title: 'Invite friends',
  /** Under the title, once there is a link to offer: what the link does. */
  intro: 'Send your link to someone. When they sign up, their name appears here.',

  /** No username at all: there is no link, and this is what makes one possible. */
  noNameBody: 'Create your username first.',
  noNameAction: 'Create your username',

  /** A username that exists but does not resolve, so a link to it opens nobody. */
  notLiveBody: 'Your invite link does not open yet. It switches on with your username.',

  /** The read failed. Nothing to offer, and nothing claimed. */
  errorBody: 'Could not load your invites.',
} as const;
