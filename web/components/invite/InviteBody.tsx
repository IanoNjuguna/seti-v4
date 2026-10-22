import { Text } from '@/components/ui';
import { INVITE_COPY } from './Invite.constants';
import { InviteState } from './InviteState';
import type { InviteView } from './Invite.types';

export interface InviteBodyProps {
  /** Exactly one of the states the read and the handles resolve to. */
  view: InviteView;
}

/**
 * The invite screen, as a function of its state: the page's own words, then
 * whichever state is true.
 *
 * Deliberately takes the state as a PROP rather than reading it, so every state can
 * be rendered and looked at on its own — a screen whose empty and dead states only
 * exist after a network round trip is a screen whose empty and dead states nobody
 * has ever seen. `useInvite` works the state out, `InviteScreen` reads it, and this
 * draws it.
 */
export function InviteBody({ view }: InviteBodyProps) {
  return (
    <div className="flex flex-col gap-4">
      <Text variant="section" as="h1">
        {INVITE_COPY.title}
      </Text>
      <Text variant="body" color="secondary" as="p">
        {INVITE_COPY.lead}
      </Text>

      <div className="mt-2">
        <InviteState view={view} />
      </div>
    </div>
  );
}
