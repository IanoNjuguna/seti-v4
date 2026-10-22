import type { ButtonVariant } from '@/lib/types';

/** One of Home's two actions: a label, a destination, and the weight it wears. */
export interface HomeAction {
  key: string;
  label: string;
  href: string;
  /**
   * Which of the system's two button recipes this one wears — `primary` is the
   * black CTA on a white band, `secondary` the outlined one beside it
   * (`design/revolut.md`, Components → Buttons). Two FILLED buttons side by side
   * is two calls to action; one filled and one outlined is a premise and its
   * alternative.
   */
  variant: Extract<ButtonVariant, 'primary' | 'secondary'>;
  /**
   * A short marker for a door that exists but cannot be used yet. The door stays so
   * the signal stays with it; a removed door is a feature nobody discovers later.
   */
  badge?: string;
}

/**
 * The two things a customer opens their account to do, side by side and full width.
 *
 * Two, not four: paying a merchant is the product, and being paid is how money
 * gets in. There is no third action because there is nowhere real to send it —
 * an inert tile reads as a broken tap (the rule the old icon strip carried), and a
 * funded account that wants to move money between people does it through `Pay`.
 *
 * `Pay` rather than `Send` is the copy decision from #94: the merchant QR is the
 * premise, and `/app/pay` is the merchant-first door onto the same flow.
 *
 * `Receive` rather than `Add money`, deliberately, and this one is a refusal of
 * the issue's own wording: the only surface that puts money in is `/app/receive`,
 * whose title is "Receive money" and whose two halves explain a username and an
 * address. Labelling it `Add money` would name a flow this product does not have —
 * v1 has no on-ramp (`backend/src/services/account.ts`) — and send the customer to
 * a page headed with a different verb. The panel's own rule already prefers the
 * label the destination answers with ("a person is not depositing this month's
 * takings into anything, they are being paid").
 */
export const HOME_ACTIONS: HomeAction[] = [
  { key: 'pay', label: 'Pay', href: '/app/pay', variant: 'primary' },
  { key: 'receive', label: 'Receive', href: '/app/receive', variant: 'secondary' },
  /*
   * Save is the third door, and it is here because the strip this replaces had it:
   * it is the one thing a funded account can do with money it is NOT spending, and
   * `/app/save` is reachable from nowhere else (`AppNav` carries Home, Activity and
   * Profile only). Removing the strip without carrying this across would have
   * orphaned a shipped page.
   *
   * Three short labels in one row, at the system's button height: `Pay` and
   * `Receive` and `Save` measure far inside a third of the column at 360px, so the
   * row still reads as three doors rather than as a cramped set.
   */
  /*
   * Saving is closed (#137): deposits revert on an unverified vault with a zero rate,
   * so the door stays and the badge says why. Hiding it would lose the signal that the
   * feature exists; greying it out would read as broken.
   */
  { key: 'save', label: 'Save', href: '/app/save', variant: 'secondary', badge: 'Soon' },
];
