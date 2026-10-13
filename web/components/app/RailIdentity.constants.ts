import type { CopyLinkState } from './RailIdentity.types';

/**
 * Copy for the identity card at the foot of the rail.
 *
 * The empty-mode words are deliberately NOT repeated here: they are the Profile
 * panel's, for the same action on the same account, and `PROFILE_INTENT_COPY` is
 * where they live. A second spelling of "Claim a username" is how one of the two
 * starts lying about what it does.
 */
export const RAIL_IDENTITY_COPY = {
  signedInAs: 'Signed in as',
  copyLink: 'Copy link',
  copied: 'Copied',
  copyBlocked: 'Copy blocked',
  copyFailed: 'Select the link above to copy it.',
} as const;

/** The control's label per state — the state is said in words, never in colour. */
export function copyLinkLabel(state: CopyLinkState): string {
  if (state === 'copied') return RAIL_IDENTITY_COPY.copied;
  if (state === 'failed') return RAIL_IDENTITY_COPY.copyBlocked;
  return RAIL_IDENTITY_COPY.copyLink;
}

/** What the control copies, named for a reader who cannot see the caption. */
export function copyLinkAriaLabel(state: CopyLinkState, caption: string): string {
  const verb = state === 'copied' ? RAIL_IDENTITY_COPY.copied : RAIL_IDENTITY_COPY.copyLink;
  return `${verb} ${caption}`;
}
