import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

/**
 * The empty state, composed rather than declared.
 *
 * "No transactions yet" is the generic version and tells a new user nothing.
 * This one says what will appear and what it will contain — and it deliberately
 * carries NO CTA of its own.
 *
 * It used to end in a "Make your first payment" pill. That pill and the pay
 * affordance directly above it are the same action: both open `/app/pay`, so a
 * new account was offered one job twice on one screen — the duplication the home
 * screen still refuses. The quick-actions strip carries the Pay tile and acts;
 * nothing else on this screen offers that action. This section explains what will
 * fill the list, and the sentence itself points at the action, so nothing is lost
 * but the second control. (Nested in a `<Link>` the pill was also two controls in
 * the DOM for one action — see `ButtonLink`.)
 *
 * The sentence is `body` + `secondary`, not `micro` (14px) in `stone`: this is
 * the only prose a brand-new account reads, and `stone` (#8d969e) on the
 * `surface-soft` well is 2.9:1 — below AA for body text, and it made the one
 * explanation on the screen look like metadata. The title/body/label ladder on
 * this screen is now `card-title` (16/600) → `body` (16/mute) → `micro`
 * (14/stone, none here).
 *
 * No margin of its own: the space between it and the section header belongs to
 * the parent that stacks them (`HomeActivity`, `ActivityStates`), so the empty
 * state and the populated list sit in exactly the same place.
 */
export function EmptyActivity() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md bg-surface-soft px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas-light text-mute"
      >
        <Icon name="qr" className="h-6 w-6" />
      </span>

      <Text variant="card-title" as="h3">
        No payments yet
      </Text>
      <Text variant="body" color="secondary" as="p" className="max-w-sm">
        Pay a Seti merchant and it shows up here with the amount, the merchant and
        the receipt — straight from the chain, not from us.
      </Text>
    </div>
  );
}
