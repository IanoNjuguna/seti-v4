import { Text } from '@/components/ui';
import type { ArrivalView } from '@/lib/api/arrivals';
import { NOTIFICATIONS_COPY } from './Notifications.constants';

/**
 * A token amount, as the chain moved it, made readable without rounding the money away.
 *
 * The stored amount is six decimal places (`"2500.000000"`), and printing all of them reads
 * as a machine talking. Two decimals always, and up to six only when the trailing digits are
 * real: `0.000042 OUSD` keeps its dust, `2,500.00 OUSD` does not carry four zeros it earned
 * from nowhere. The integer part is grouped, because that is what makes a figure scannable.
 */
export function formatAmount(amount: string): string {
  const [whole, fraction = ''] = amount.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  const decimals = trimmed.length > 2 ? trimmed : trimmed.padEnd(2, '0');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals.length > 0 ? `${grouped}.${decimals}` : grouped;
}

/** `0x1234…abcd`, which is how a person recognises an address without reading 42 characters. */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/**
 * One arrival: an amount in the asset it arrived in, who sent it, and when it was seen (#592).
 *
 * THE FIGURE IS NOT CONVERTED, AND THAT IS DELIBERATE. `ArrivalView` carries no fiat: the
 * server's view is the token amount and the block it moved in. Rendering KES here would mean
 * the browser inventing a rate, which is the one thing the money surfaces in this app never do.
 * The asset is printed beside the number so the figure is unambiguous — `12.50 OUSD` claims
 * nothing it cannot back.
 *
 * THE SENDER IS THE POINT OF THE ROW. An arrival is money with no charge behind it, so the
 * only handle a customer has on "what was this for" is who sent it. It is shortened, because a
 * full address is a wall of characters on a phone, and the full one is one tap away on the
 * chain through `txHash`.
 */
export function ArrivalRow({ arrival, isNew }: { arrival: ArrivalView; isNew: boolean }) {
  const when = new Date(arrival.seenAt);

  return (
    <li className="flex items-start justify-between gap-3 py-3.5">
      <div className="min-w-0">
        <Text variant="tab" as="p" tabular>
          {formatAmount(arrival.amount)} <span className="text-ink-muted">{arrival.asset.toUpperCase()}</span>
        </Text>
        <Text variant="micro" as="p" color="secondary" className="mt-0.5 truncate">
          {NOTIFICATIONS_COPY.fromSender(shortAddress(arrival.from))}
        </Text>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {isNew ? (
          <Text
            variant="micro"
            as="span"
            color="inverse"
            className="rounded-full bg-accent-lime px-2 py-0.5 text-canvas-dark"
          >
            {NOTIFICATIONS_COPY.newMark}
          </Text>
        ) : null}
        <Text variant="micro" as="span" color="secondary" tabular>
          {when.toLocaleString('en-KE', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </div>
    </li>
  );
}
