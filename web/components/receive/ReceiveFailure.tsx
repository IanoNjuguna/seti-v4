'use client';

import { Button, StateMessage } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { RECEIVE_PAGE_COPY } from './ReceivePage.constants';

export interface ReceiveFailureProps {
  /** Why the account read failed, in the words `lib/api/refusal.ts` chose. */
  message: string;
  /** Re-runs the account read. The same call the rest of the app makes. */
  retry: () => void;
}

/**
 * The account read failed, so there is nothing to draw a code from.
 *
 * Named rather than empty: this surface has no session of its own to fall back on, and
 * an empty column under a title is indistinguishable from a page that has not finished
 * loading. `failure` (not `empty`) because something went wrong and the fix is an
 * action, and the message is the refusal's own sentence rather than a raw error.
 *
 * No fallback handle and no cached code: the string on this page is the address money
 * is sent to, and a plausible-looking one drawn from a stale read is worse than none.
 */
export function ReceiveFailure({ message, retry }: ReceiveFailureProps) {
  return (
    <StateMessage
      variant="failure"
      icon={<Icon name="alert" className="h-5 w-5" />}
      title={RECEIVE_PAGE_COPY.failedTitle}
      body={message || RECEIVE_PAGE_COPY.failedBody}
      action={
        <Button variant="secondary" onClick={retry}>
          {RECEIVE_PAGE_COPY.failedAction}
        </Button>
      }
    />
  );
}
