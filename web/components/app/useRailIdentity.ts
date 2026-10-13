'use client';

import { useSession } from '@/lib/auth';
import { HANDLE_KIND_FOR_INTENT, handleForIntent, useAccountIdentity } from '@/lib/account';
import { handleLink, handleLinkLabel } from '@/lib/merchant-link';
import { PROFILE_INTENT_COPY, claimHref } from '@/components/profile/ProfileIntent.constants';
import type { UseRailIdentityReturn } from './RailIdentity.types';

/**
 * Who the rail's identity card is about, from the app's EXISTING sources.
 *
 * Nothing is fetched here and nothing is derived twice: the session answers who
 * is signed in, `useAccountIdentity` answers which handles the account holds (the
 * same one read the gate and the Profile panel read, so the rail cannot disagree
 * with either), `handleForIntent` picks the active mode's handle by the same rule
 * Profile uses, and `merchant-link.ts` builds the link.
 *
 * Three states, and they are not interchangeable:
 *
 *  - **signed out** — `signedIn: false`, and the card says nothing at all. The
 *    rail is drawn for a first-time visitor by the gate's own design;
 *  - **signed in, names unknown** — the account line only. Reachable for one
 *    frame at most inside the shell, but a claim link offered on a guess would be
 *    a link to the wrong kind of name;
 *  - **signed in, names known** — the mode's handle and its link, or the claim
 *    route for that same kind when the mode has no name yet.
 *
 * The handle passed to `handleLink` is the STORED one rather than the name: the
 * route on the card and the string on the card are then the same string by
 * construction, and `merchantHandle` is idempotent on a stored handle (already
 * lowercase, only URL-safe characters), so it is the same link `handleLink(name)`
 * gives.
 */
export function useRailIdentity(): UseRailIdentityReturn {
  const session = useSession();
  const account = useAccountIdentity();

  const identity = account.identity;
  const intent = identity?.intent ?? 'personal';
  const kind = HANDLE_KIND_FOR_INTENT[intent];
  const held = identity ? handleForIntent(identity.handles, intent) : null;
  const personal = intent === 'personal';

  return {
    signedIn: session.isAuthenticated,
    signedInAs: session.user?.email ?? null,
    handle: held
      ? {
          handle: held.handle,
          link: handleLink(kind, held.handle),
          caption: handleLinkLabel(kind, held.handle),
        }
      : null,
    claim:
      identity && !held
        ? {
            href: claimHref(kind),
            label: personal
              ? PROFILE_INTENT_COPY.emptyPersonalAction
              : PROFILE_INTENT_COPY.emptyBusinessAction,
            title: personal
              ? PROFILE_INTENT_COPY.emptyPersonalTitle
              : PROFILE_INTENT_COPY.emptyBusinessTitle,
          }
        : null,
  };
}
