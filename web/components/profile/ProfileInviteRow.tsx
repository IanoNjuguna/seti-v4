'use client';

import Link from 'next/link';
import { Skeleton } from '@/components/ui';
import { handleForIntent, useAccountIdentity } from '@/lib/account';
import { PROFILE_INVITE_COPY } from './ProfileInvite.constants';
import { claimHref } from './ProfileIntent.constants';
import { ProfileRow } from './ProfileRow';

const ACTION_CLASS =
  'inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/**
 * The profile's Invite row — a shortcut whose destination depends on the account.
 *
 * Inviting REQUIRES a username first (#145): the link is `seti.live/i/<handle>`, and
 * a link has to name an account that exists. So the row cannot always offer one, and
 * pretending otherwise would ship a link to a page that resolves to nobody:
 *
 *  1. **no username** → the row states "Create your username first" and carries the
 *     claim surface as its action, because that is the only thing that unlocks a
 *     link. It does not link to `/app/invite`: a screen whose whole content is
 *     another instruction is a dead click.
 *  2. **live** → the row IS the link to the invite screen, which carries the link
 *     itself, the count and who joined.
 *
 * It is a `ProfileRow`, not a band of its own (#142), so it shares the shortcut
 * list's left edge, row height and hairline.
 *
 * The THIRD state the issue describes — a username claimed but parked for brand
 * review, so the link does not open yet — has no client answer to read any more.
 * `#148` removed the held-brand queue and the `review` flag went out of
 * `HandleIdentity` with it: a claimed name is live the moment it verifies, so the
 * only states an account can be in here are "no name yet" and "a name that pays".
 * The `/i/<handle>` landing keeps its own guard for a handle that does not resolve,
 * which is where a link that names nobody is actually stopped.
 *
 * The row is drawn from the account identity the rest of the app reads
 * (`useAccountIdentity`), never from a second request: the rail, the mode row and
 * this row then cannot disagree about whether the account holds a username.
 */
export function ProfileInviteRow() {
  const account = useAccountIdentity();
  const username = account.identity ? handleForIntent(account.identity.handles, 'personal') : null;

  if (account.loading || !account.identity) {
    /* The row keeps its height while the handles are unknown, so the page does not
       jump: a row that appeared later would move everything under it. */
    return (
      <ProfileRow title={PROFILE_INVITE_COPY.title} icon="send">
        <Skeleton className="h-4 w-40" />
      </ProfileRow>
    );
  }

  if (!username) {
    return (
      <ProfileRow
        title={PROFILE_INVITE_COPY.title}
        subtitle={PROFILE_INVITE_COPY.noNameBody}
        icon="send"
      >
        <Link href={claimHref('person')} className={ACTION_CLASS}>
          {PROFILE_INVITE_COPY.noNameAction}
        </Link>
      </ProfileRow>
    );
  }

  return (
    <ProfileRow
      title={PROFILE_INVITE_COPY.title}
      subtitle={PROFILE_INVITE_COPY.intro}
      href="/app/invite"
      icon="send"
    />
  );
}
