'use client';

import { ButtonLink, StateMessage } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import type { ReceiveClaimView } from './useReceiveView.types';

export interface ReceiveNoNameProps {
  claim: ReceiveClaimView;
}

/**
 * The state an account with no name of its own lands in.
 *
 * It used to be nothing: the username half returned `null` when the mode held no
 * handle, which left a page title above an empty column. While the page had an address
 * half and a merchant half that was survivable — there was something else to read. With
 * the username as the only thing this page shows, `null` is a blank page, so the state
 * has to speak.
 *
 * It says three things, in the order a person needs them: WHAT is missing (the title),
 * why it matters on this page (the middle sentence, which only this page can write), and
 * the one action that fixes it. The title and the action are the rail's own words, via
 * `useRailIdentity().claim`, so a claim offered here cannot promise anything different
 * from the claim offered in the rail — and it is the same `/app/merchant` route, not a
 * second front door.
 *
 * No code, no skeleton, no placeholder handle: a code for a name that does not exist
 * resolves to nobody, and a skeleton claims data is coming for an account that has
 * nothing to send.
 */
export function ReceiveNoName({ claim }: ReceiveNoNameProps) {
  return (
    <StateMessage
      variant="empty"
      icon={<Icon name="profile" className="h-7 w-7" />}
      title={claim.title}
      body={claim.body}
      action={
        <ButtonLink href={claim.href} variant="primary">
          {claim.label}
        </ButtonLink>
      }
    />
  );
}
