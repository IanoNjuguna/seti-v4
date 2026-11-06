'use client';

import Link from 'next/link';
import { HOME_PAGE_COPY } from './HomePage.constants';

/**
 * The one instruction a new account gets, between the doors and the streak (#387).
 *
 * ## Why it exists at all
 *
 * The onboarding wizard ends at a claimed name, and the home screen that follows is four labelled
 * doors over a balance of nothing. Every part of it is honest and none of it says what to do first.
 * For a merchant the answer is Receive: the customer scans the code at the counter, and the first
 * payment is what makes the streak, the token list and `Paid recently` mean anything.
 *
 * ## Why a line rather than a fifth button
 *
 * Four doors is already the row the owner asked for, and a fifth control beside them would compete
 * with the one door it is telling you to open. So this is a sentence with a link in it, at the voice
 * of a page note, and it disappears the moment the account has a payment.
 *
 * ## Why Receive, and not "add money"
 *
 * v1 has no on-ramp: no card, no bank transfer, no mobile money (`account.ts`). The only way money
 * arrives is a payment from someone else, so the only honest first instruction is the one that puts
 * the code in front of a customer.
 */
export function HomeStarter() {
  return (
    <p className="text-body-sm text-mute">
      {HOME_PAGE_COPY.starterMessage}{' '}
      <Link
        href={HOME_PAGE_COPY.starterHref}
        className="relative rounded-sm font-semibold text-primary after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {HOME_PAGE_COPY.starterAction}
      </Link>
    </p>
  );
}
