'use client';

import { useEffect, useState } from 'react';
import { ApiError, fetchMyReferrals } from '@/lib/api';
import type { AccountIdentity, ReferralSummary } from '@/lib/api';
import { handleForIntent, useAccountIdentity } from '@/lib/account';
import type { InviteView, UseInviteViewReturn } from './Invite.types';

type Read =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; summary: ReferralSummary };

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Try again in a moment.';
}

/**
 * What the invite surfaces can say, worked out ONCE for both of them.
 *
 * The invite screen and the Profile row ask the same question ("is there a link, and
 * who joined") and must never answer it differently, so the answer is computed here
 * and read by both. Two derivations would be two rules, and the row would eventually
 * offer a link the screen says does not exist.
 *
 * TWO SOURCES, and they answer different halves:
 *
 *  - `GET /referrals/me` says whether a LINK exists. That is the server's call, and
 *    it is the only one that can make it: `summary.link` is `null` when the account's
 *    username does not resolve, which is the same fact that decides whether
 *    `seti.live/i/<handle>` opens anybody. Deriving "live" from a handle row on the
 *    client would be a second opinion about a name the server already judged.
 *  - the account identity says why there is no link: a person handle present means a
 *    username that does not resolve yet (not live); no person handle means none has
 *    been claimed (create your username first). The two are told apart because the
 *    sentence, and the action, differ: one offers the claim surface, the other must
 *    not, because the claim would refuse an existing name.
 *
 * State is written only from the promise callbacks, and the effect is guarded, so a
 * screen dismissed mid-read cannot be written to afterwards.
 */
export function useInviteView(): UseInviteViewReturn {
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

  return { view: resolveView(read, account.identity) };
}

/** The read and the handles, folded into the one state the surfaces switch on. */
function resolveView(read: Read, identity: AccountIdentity | null): InviteView {
  // Until the handles are known, "no username" is a guess, and a guess here offers a
  // claim link to someone who already holds the name. The failure is reported first
  // because a failed read is a fact whatever the handles say.
  if (!identity) return read.kind === 'error' ? { kind: 'error', message: read.message } : { kind: 'loading' };
  if (read.kind === 'error') return { kind: 'error', message: read.message };
  if (read.kind === 'loading') return { kind: 'loading' };

  const username = handleForIntent(identity.handles, 'personal');

  if (!username) return { kind: 'no-name' };
  if (!read.summary.link) return { kind: 'not-live' };

  return {
    kind: 'live',
    link: read.summary.link,
    count: read.summary.count,
    joined: read.summary.joined,
  };
}
