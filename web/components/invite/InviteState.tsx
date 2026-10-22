import { StateMessage } from '@/components/ui';
import { claimHref } from '@/components/profile/ProfileIntent.constants';
import { INVITE_COPY } from './Invite.constants';
import { InviteJoined } from './InviteJoined';
import { InviteLinkField } from './InviteLinkField';
import { InviteLoading } from './InviteLoading';
import { InviteStateNote } from './InviteStateNote';
import type { InviteView } from './Invite.types';

/**
 * The state of the page, one branch per case — and the cases are not
 * interchangeable:
 *
 *  - no username → there is no link, and the way out is to claim one;
 *  - not live    → there IS a username, but a link to it opens nobody, so no link is
 *                  offered and no claim is offered either (the claim would refuse);
 *  - live        → the link, and the people it brought;
 *  - error       → our sentence, never an empty invite (which would claim the
 *                  account has invited nobody, a different fact from a failed read).
 */
export function InviteState({ view }: { view: InviteView }) {
  if (view.kind === 'loading') return <InviteLoading />;

  if (view.kind === 'error') {
    return <StateMessage variant="failure" title={INVITE_COPY.errorTitle} body={view.message} />;
  }

  if (view.kind === 'no-name') {
    return (
      <InviteStateNote
        title={INVITE_COPY.noNameTitle}
        body={INVITE_COPY.noNameBody}
        action={{ href: claimHref('person'), label: INVITE_COPY.noNameAction }}
      />
    );
  }

  if (view.kind === 'not-live') {
    return <InviteStateNote title={INVITE_COPY.notLiveTitle} body={INVITE_COPY.notLiveBody} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <InviteLinkField value={view.link} />
      <InviteJoined count={view.count} joined={view.joined} />
    </div>
  );
}
