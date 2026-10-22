'use client';

import { handleForIntent, useAccountIdentity } from '@/lib/account';
import { useSession } from '@/lib/auth';
import type { UseProfileIdentityReturn } from './ProfileIdentity.types';

/** The name a person goes by when the account carries one, split and joined. */
function sessionName(user: { firstName: string | null; lastName: string | null } | null): string {
  if (!user) return '';
  return [user.firstName, user.lastName]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

/**
 * The person, from the account read the app already holds.
 *
 * ONE read (`useAccountIdentity`) and ONE bridge (`handleForIntent`), so this
 * block, the mode row and the rest of the app cannot disagree about which name
 * the account is acting under. `handles` is scoped to the acting network by the
 * server, so nothing here filters a practice name out of a live list.
 *
 * The name is the session's own first and last name when the product has one,
 * then the active handle's name, then the neutral "Your account". The last two
 * exist so a slow or stale handle list paints something true rather than an empty
 * heading: the gate only lets an account that holds a handle onto this route, and
 * a name that has not arrived yet is not a reason to render a blank.
 */
export function useProfileIdentity(): UseProfileIdentityReturn {
  const account = useAccountIdentity();
  const session = useSession();

  const identity = account.identity;
  const held = identity ? handleForIntent(identity.handles, identity.intent) : null;
  const name = sessionName(session.user) || held?.name?.trim() || 'Your account';

  return {
    name,
    handle: held?.handle ?? null,
    businesses: identity?.handles.filter((candidate) => candidate.kind === 'business') ?? [],
  };
}
