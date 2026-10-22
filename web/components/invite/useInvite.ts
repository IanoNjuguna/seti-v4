'use client';

import { useEffect, useState } from 'react';
import { ApiError, fetchMyReferrals } from '@/lib/api';
import type { AccountIdentity, ReferralSummary } from '@/lib/api';
import { handleForIntent, useAccountIdentity } from '@/lib/account';
import { inviteLink } from '@/lib/merchant-link';
import type { InviteView, UseInviteReturn } from './Invite.types';

type Read =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; summary: ReferralSummary };

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Try again in a moment.';
}

/**
 * The invite screen's one read, and the state it resolves to.
 *
 * TWO SOURCES, deliberately, and they answer different questions:
 *
 *  - `GET /referrals/me` answers "what may I hand out, and who arrived" — the link
 *    and the count come from the server that wrote the rows, never assembled here.
 *  - the account identity answers "why is there no link", which the first read
 *    cannot: it reports `handle: null` both for an account with no username and for
 *    a username that is parked for review, because a parked name resolves to nobody
 *    either way. The difference is what the person is told to do, so it comes from
 *    the handles the account actually holds.
 *
 * A parked name is `not-live` even though the summary also carries a `null` link,
 * and it is checked FIRST: telling a person with a name under review to "create
 * your username" would send them to a claim that refuses them.
 *
 * State is written only from the promise callbacks, and the effect is guarded, so a
 * screen dismissed mid-read cannot be written to afterwards.
 */
export function useInvite(): UseInviteReturn {
  const account = useAccountIdentity();
  const [read, setRead] = useState<Read>({ kind: 'loading' });

  useEffect(() => {
    let active = true;

    void fetchMyReferrals()
      .then((summary) => {
        if (active) setRead({ kind: 'ready', summary });
      })
      .catch((error: unknown) => {
        if (active) setRead({ kind: 'error', message: toMessage(error) });
      });

    return () => {
      active = false;
    };
  }, []);

  const view = resolveView(read, account.identity, account.loading);

  return { view };
}

/** The read and the handles, folded into the one state the screen switches on. */
function resolveView(
  read: Read,
  identity: AccountIdentity | null,
  identityLoading: boolean
): InviteView {
  if (read.kind === 'error') return { kind: 'error', message: read.message };

  const username = identity ? handleForIntent(identity.handles, 'personal') : null;

  // Only after the handles are known: until then "no username" is a guess, and a
  // guess here offers a claim link to someone who already holds the name.
  if (identityLoading || !identity) return { kind: 'loading' };

  if (username?.review) return { kind: 'not-live' };
  if (!username) return { kind: 'no-name' };
  if (read.kind === 'loading') return { kind: 'loading' };

  return {
    kind: 'live',
    link: read.summary.link ?? inviteLink(username.handle),
    count: read.summary.count,
    joined: read.summary.joined,
  };
}
