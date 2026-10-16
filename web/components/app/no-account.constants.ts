import type { NoAccountWhat } from './no-account.types';

/**
 * The app's ONE voice for "there is nothing to show, because there is no
 * account". A visitor sees the shape of the product and one sentence where the
 * data would be — never a zero, and never a figure they could mistake for money.
 *
 * Two lines, and the second is not a nicety. `restoring` is the app still
 * finding out whether anyone is signed in: telling that person to sign in would
 * be the one thing this whole screen is designed not to do (a customer who is
 * signed in being told otherwise cannot tell which way is up), so it says
 * nothing about identity at all.
 *
 * ONE implementation, read by every surface that has no account behind it, for
 * the same reason `EmptyActivity` is shared: two spellings of one idea is how
 * one of them starts lying about what it means.
 */
export const NO_ACCOUNT_COPY = {
  /** `Sign in to see your balance.` / `Sign in to see your activity.` */
  anonymous: (what: NoAccountWhat): string => `Sign in to see ${what}.`,
  /** Said while the app is still finding out who is here. No claim, no instruction. */
  restoring: 'One moment…',
} as const;
