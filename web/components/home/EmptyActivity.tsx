import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

/**
 * The empty state, composed rather than declared.
 *
 * "No transactions yet" is the generic version and tells a new user nothing.
 * This one says what will appear and what it will contain — and it deliberately
 * carries NO CTA of its own.
 *
 * It used to end in a "Make your first payment" pill. That pill and the
 * `ScanPayCard` directly above it are the same action: both open `/app/pay`, so a
 * new account was offered one job twice on one screen — the exact duplication
 * `quick-actions.constants` refuses when it keeps Pay out of the tile strip.
 * The home screen's pay entry is `ScanPayCard`; this section explains what will
 * fill it, and the sentence itself points at the action, so nothing is lost but
 * the second control. (Nested in a `<Link>` the pill was also two controls in the
 * DOM for one action — see `ButtonLink`.)
 */
export function EmptyActivity() {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-md bg-surface-soft px-6 py-10 text-center">
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
    </div>
  );
}
