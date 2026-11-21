import { Text } from '@/components/ui';
import type { ArrivalView } from '@/lib/api/arrivals';
import { NOTIFICATIONS_COPY } from './Notifications.constants';

/**
 * One arrival: an amount in the asset it arrived in, the address that received it, and the
 * instant (#592).
 *
 * THE FIGURE IS NOT CONVERTED, AND THAT IS DELIBERATE. `ArrivalView` carries no fiat: the
 * server's view is the token amount. Rendering KES here would mean the browser inventing a
 * rate, which is the one thing the money surfaces in this app never do. The asset is printed
 * beside the number so the figure is unambiguous — `12.50 OUSD` claims nothing it cannot back.
 */
export function ArrivalRow({ arrival, isNew }: { arrival: ArrivalView; isNew: boolean }) {
  const when = new Date(arrival.createdAt);

  return (
    <li className="flex items-start justify-between gap-3 py-3.5">
      <div className="min-w-0">
        <Text variant="tab" as="p" tabular>
          {arrival.amount} <span className="text-ink-muted">{arrival.asset}</span>
        </Text>
        <Text variant="micro" as="p" color="secondary" className="mt-0.5 truncate">
          {arrival.matched ? NOTIFICATIONS_COPY.matched : NOTIFICATIONS_COPY.unmatched}
          {' · '}
          {arrival.recipient}
        </Text>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {isNew ? (
          <Text variant="micro" as="span" color="inverse" className="rounded-full bg-accent-lime px-2 py-0.5 text-canvas-dark">
            {NOTIFICATIONS_COPY.newMark}
          </Text>
        ) : null}
        <Text variant="micro" as="span" color="secondary" tabular>
          {when.toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </div>
    </li>
  );
}
