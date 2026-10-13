import Link from 'next/link';
import { Button, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

/**
 * The empty state, composed rather than declared.
 *
 * "No transactions yet" is the generic version and tells a new user nothing.
 * This one says what will appear, what it will contain, and gives them the one
 * action that makes something appear in it — which is the whole point of an
 * empty state on a money screen.
 */
export function EmptyActivity() {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-lg bg-surface-soft px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas-light text-mute"
      >
        <Icon name="qr" className="h-6 w-6" />
      </span>

      <Text variant="card-title" as="h3">
        No payments yet
      </Text>
      <Text variant="micro" as="p" className="max-w-sm">
        Pay a Seti merchant and it shows up here with the amount, the merchant and
        the receipt — straight from the chain, not from us.
      </Text>

      <Link href="/app/pay" className="mt-1 inline-flex">
        <Button variant="primary">Make your first payment</Button>
      </Link>
    </div>
  );
}
