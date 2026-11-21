'use client';

import { useEffect } from 'react';
import { Button, Card, StateMessage, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { NOTIFICATIONS_COPY } from './Notifications.constants';
import { ArrivalRow } from './ArrivalRow';
import { useArrivals } from './useArrivals';
import { useSeenArrivals } from './useSeenArrivals';

/**
 * The arrivals list (#592).
 *
 * THE FAILURE STATE IS THE APP'S FAILURE PRIMITIVE, not a card of its own: `StateMessage`
 * draws `failure` on the page and `empty` as a soft well, and the two shapes reading
 * differently is the whole point — a read that failed and an account where nothing has
 * arrived are different facts, and only one of them has something to retry.
 *
 * The failed state carries NO count and never writes the seen instant: a read that timed out
 * must not mark money as read that nobody saw. `retry` is the only affordance, because the
 * alternative — a cached number — would be a claim about money we could not read.
 *
 * The list marks rows this browser has not shown before, using an instant it wrote last time.
 * That is per-device on purpose, and the constants file says why.
 */
export function NotificationsScreen() {
  const { state, retry } = useArrivals();
  const { seenAt, markSeen } = useSeenArrivals();

  useEffect(() => {
    if (state.kind === 'ready' || state.kind === 'empty') markSeen();
  }, [state.kind, markSeen]);

  return (
    <div className="flex flex-col gap-6">
      <Text variant="section" as="h1">
        {NOTIFICATIONS_COPY.title}
      </Text>

      {state.kind === 'loading' ? (
        <Text variant="body" as="p" color="secondary">
          {NOTIFICATIONS_COPY.loading}
        </Text>
      ) : null}

      {state.kind === 'failed' ? (
        <StateMessage
          variant="failure"
          title={NOTIFICATIONS_COPY.failedTitle}
          body={NOTIFICATIONS_COPY.failed}
          action={
            <Button onClick={() => void retry()}>{NOTIFICATIONS_COPY.retry}</Button>
          }
        />
      ) : null}

      {state.kind === 'empty' ? (
        <StateMessage
          variant="empty"
          icon={<Icon name="bell" className="h-5 w-5" />}
          title={NOTIFICATIONS_COPY.emptyTitle}
          body={NOTIFICATIONS_COPY.empty}
        />
      ) : null}

      {state.kind === 'ready' ? (
        <Card padding="sm">
          {/* The server's own sentence about what an arrival is, because a surface inventing
              a fifth phrasing for the same fact is how two screens start disagreeing. */}
          <Text variant="micro" as="p" color="secondary" className="pb-2">
            {state.page.copy.detail}
          </Text>
          <ul className="divide-y divide-hairline">
            {state.page.arrivals.map((arrival) => (
              <ArrivalRow
                key={arrival.txHash}
                arrival={arrival}
                // A browser with no stored instant has seen nothing, so everything is new. That is
                // the first visit, and telling someone their money is old would be wrong.
                isNew={seenAt === null || arrival.seenAt > seenAt}
              />
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
