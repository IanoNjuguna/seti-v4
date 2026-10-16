import type { StackedPayment } from './PaymentStack.types';

/**
 * Three movements, in the app's own row language: two that arrived, one that
 * went out.
 *
 * Why three and not one card. The band answers "what happens when someone pays
 * you", so the first card is a payment landing — but a merchant with a balance
 * also spends from it, and a stack of three arrivals would say the product only
 * has one direction. Two in and one out is the honest shape of a working day.
 *
 * FIAT ONLY. A customer never sees a token name: the amounts are KES, the
 * currency this app prices and displays in, and nothing here names the asset a
 * payment settled in. That is the app's business, and putting it on a marketing
 * page would be a figure nobody asked for in a unit nobody holds.
 *
 * TIMES ARE HONEST, AND THEY AGREE WITH EACH OTHER. Newest first, all three
 * different, and the phrasing steps from minutes to a named day the way a real
 * feed does. Three cards reading "just now" is the tell that nobody looked at
 * the thing they shipped — and on a payments page it reads as a mock-up.
 */
export const STACKED_PAYMENTS: StackedPayment[] = [
  {
    id: 'mama-oliech',
    name: 'Mama Oliech Kitchen',
    amount: 1250,
    currency: 'KES',
    detail: 'Paid by @wanjiku',
    time: '2 min ago',
  },
  {
    id: 'kilimani-pharmacy',
    name: 'Kilimani Pharmacy',
    amount: 3400,
    currency: 'KES',
    detail: 'Paid by @otieno',
    time: '1 hr ago',
  },
  {
    id: 'send-jabali',
    name: '@jabali',
    amount: -800,
    currency: 'KES',
    detail: 'Sent',
    time: 'Yesterday',
  },
];

/**
 * The entrance classes, and the cap, in one place.
 *
 * `design/motion.md` (DIAL ONE) staggers the hero's lines by `--stagger` and
 * then STOPS; this is the same vocabulary used once more, capped at three. The
 * stack's cards arrive 0 / 40ms / 80ms after the band's own reveal, run ONCE
 * (the section's reveal arms them and never replays), and a fourth card would
 * arrive with the third rather than queueing behind it. A stagger that keeps
 * going is decoration; the list is three, and the cap is three.
 */
export const STACK_ENTRANCE_CLASSES = [
  'stack-item',
  'stack-item stack-item-2',
  'stack-item stack-item-3',
] as const;
