'use client';

import Link from 'next/link';
import { Skeleton } from '@/components/ui';
import { useInviteView } from '@/components/invite/useInviteView';
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
 * pretending otherwise would ship a link to a page that resolves to nobody.
 *
 * It is a `ProfileRow` rather than a band of its own (#142), so it sits in the
 * shortcut list with the same left edge, row height and hairline as `Get paid` and
 * `Account safety`, and adds no second list under the person.
 *
 * The state is the INVITE SCREEN'S OWN (`useInviteView`), not a second opinion about
 * whether a link exists: the SERVER decides that when it answers `/referrals/me`, and
 * a row that guessed from the handle row could offer a link the screen then says does
 * not exist. The states, and what each offers:
 *
 *  - **loading** → its own height and no words, so the page does not jump when the
 *    answer arrives.
 *  - **live** → the row IS the link to the invite screen, which carries the link, the
 *    count and the people it brought.
 *  - **no-name** → "Create your username first", with the claim surface as the action,
 *    because that is the only thing that unlocks a link. It does not link to
 *    `/app/invite`: a screen whose only content is the same instruction is a dead click.
 *  - **not-live** → a username that resolves to nobody, so the row says so and offers
 *    NO action; the claim surface would refuse this account and the invite screen would
 *    repeat the same sentence.
 *  - **error** → the read failed, which is the one state with nothing to offer: saying
 *    so stops here rather than promising a link that may not exist.
 */
export function ProfileInviteRow() {
  const { view } = useInviteView();

  if (view.kind === 'loading') {
    return (
      <ProfileRow title={PROFILE_INVITE_COPY.title} icon="send">
        <Skeleton className="h-4 w-40" />
      </ProfileRow>
    );
  }

  if (view.kind === 'live') {
    return (
      <ProfileRow
        title={PROFILE_INVITE_COPY.title}
        subtitle={PROFILE_INVITE_COPY.intro}
        href="/app/invite"
        icon="send"
      />
    );
  }

  if (view.kind === 'no-name') {
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
      subtitle={view.kind === 'error' ? PROFILE_INVITE_COPY.errorBody : PROFILE_INVITE_COPY.notLiveBody}
      icon="send"
    />
  );
}
