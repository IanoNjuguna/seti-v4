import type { ShareState } from '@/components/receive/useShareLink.types';

/**
 * Every word the invite screen renders.
 *
 * The screen's job is one object (the link) and one fact (who joined), so the copy
 * is short and states nothing it cannot back:
 *
 *  - The link is called an INVITE LINK, never "your referral code": a code implies
 *    something to redeem, and nothing is redeemed here.
 *  - The count is a sentence built by `countSentence`, because "1 people joined"
 *    is the kind of detail that makes a screen feel unattended. It says PEOPLE,
 *    not "referrals" — the person reading it invited friends.
 *  - The two states where there is NO link say why, and both name the username as
 *    the thing to do, because a link that names nobody cannot work: inviting
 *    requires a username first.
 *  - Nothing promises a reward. There is none, and a sentence implying one would be
 *    a claim the product does not keep.
 */
export const INVITE_COPY = {
  title: 'Invite friends',
  lead: 'Send this link to someone. When they open it and sign up, their name appears here.',

  /** The caption over the one field, naming what the string underneath is. */
  fieldLabel: 'Your invite link',
  copyLabel: 'Copy link',
  copied: 'Copied',
  copyFailed: 'Could not copy. Select the link and copy it by hand.',

  share: 'Share',
  shared: 'Shared',
  /** Where the OS sheet is absent and the clipboard took it instead. */
  sharedByCopy: 'Link copied',
  shareFailed: 'Could not share or copy. Select the link above.',

  joinedTitle: 'Who joined',
  /** Nobody yet: said as a fact, and as the thing that will change it. */
  joinedEmpty: 'Anybody who signs up from your link appears here, by username.',
  /** An invitee who has not claimed a name yet: still a person, not a blank row. */
  joinedNoName: 'No username yet',
  /** The date under each name, in the product's one date style. */
  joinedOn: (iso: string) => formatDay(iso),

  /** No username at all: the link cannot exist, and this is the way to fix it. */
  noNameTitle: 'Create your username first',
  noNameBody: 'Your invite link has to name you, so a link works only once you have a username.',
  noNameAction: 'Create your username',

  /**
   * A username exists but does not resolve, so a link to it opens nobody.
   *
   * The sentence names no cause on purpose: what withholds a name above the signature
   * is the backend's business (and has changed once already), while the fact the person
   * experiences is that the link does not open yet.
   */
  notLiveTitle: 'Your invite link is not live',
  notLiveBody:
    'Your username does not resolve yet, so a link to it would open nobody. This switches on when the name does.',

  errorTitle: 'Could not load your invite',
  loading: 'Loading your invite',
} as const;

/** How many people joined, in words that survive the number 1. */
export function countSentence(count: number): string {
  if (count <= 0) return 'Nobody has joined on your link yet.';
  if (count === 1) return '1 person has joined on your link.';
  return `${count} people have joined on your link.`;
}

/**
 * A join date as a day, in UTC and in one locale.
 *
 * Fixed locale and fixed timezone rather than the reader's: the server and the
 * browser must produce the SAME string or the page hydrates a different sentence
 * than it rendered, and a referrer in Nairobi and a server in Dublin would
 * otherwise disagree about which day someone joined.
 */
export function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * What the Share control says after a press, in the words of the path that ran.
 *
 * Idle is empty rather than a promise: a control that always carries a sentence
 * under it teaches the reader to ignore that line, which is where the failure would
 * appear.
 */
export function describeShare(state: ShareState): string {
  if (state === 'shared') return INVITE_COPY.shared;
  if (state === 'copied') return INVITE_COPY.sharedByCopy;
  if (state === 'failed') return INVITE_COPY.shareFailed;
  return '';
}
