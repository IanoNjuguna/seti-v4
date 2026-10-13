import Link from 'next/link';
import { Text } from '@/components/ui';
import { PERSON_COPY, SEND_ACTION_CLASS } from './PersonPublic.constants';
import type { PersonSendActionProps } from './PersonPublic.types';

/**
 * The page's one primary action: Send, carrying the handle into the SEND flow.
 *
 * The href is `/app/send?to=<handle>` — the send flow, not the merchant pay flow.
 * A username is paid the same way any person is: the server resolves it to a name
 * AND an address, the customer sees both, and the ADDRESS is what gets signed. No
 * second entry path is invented; it reuses the send panel a typed address uses.
 *
 * It is an ordinary anchor, so this page needs no session to render it. Following
 * it enters the product app, which is where sign-in lives: the note says so,
 * because a stranger should not have to tap to discover they need an account.
 */
export function PersonSendAction({ handle }: PersonSendActionProps) {
  return (
    <div>
      <Link href={`/app/send?to=${encodeURIComponent(handle)}`} className={SEND_ACTION_CLASS}>
        {PERSON_COPY.send}
      </Link>
      <Text variant="micro" as="p" className="mt-2">
        {PERSON_COPY.signInNote}
      </Text>
    </div>
  );
}
