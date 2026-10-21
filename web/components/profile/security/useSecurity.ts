'use client';

import { usePrivy } from '@privy-io/react-auth';
import type { SignInMethodKey, UseSecurityReturn } from './SecurityScreen.types';

/**
 * What protects this account, read from the account itself.
 *
 * The sign-in method comes from `linkedAccounts`, in a fixed order of preference: an
 * account can hold several, and the one the customer means by "how I sign in" is the
 * one they pressed. Google wins over email because it is the button; the wallet comes
 * last because every account has one.
 *
 * The second factor comes from `user.mfaMethods`, never from a flag of ours: a stored
 * "mfa: true" is a claim about the past, and this screen exists to describe the present.
 *
 * ## Why this hook cannot remove a method
 *
 * Privy's `unenrollMfa` takes an access token and supports only `sms` and `totp`; a
 * passkey is removed by `unlinkPasskeyAccount` instead. Two calls, two shapes, one of
 * them needing a token minted for the purpose. Rather than ship half of that behind a
 * button labelled "Turn off", the screen states plainly that removal is not in the app
 * yet and lets the customer add another method.
 */
export function useSecurity(): UseSecurityReturn {
  const { user } = usePrivy();

  const accounts = user?.linkedAccounts ?? [];
  const order: readonly SignInMethodKey[] = ['google_oauth', 'email', 'passkey', 'sms', 'wallet'];
  const signIn: SignInMethodKey =
    order.find((type) => accounts.some((account) => account.type === type)) ?? 'unknown';

  const methodCount = user?.mfaMethods?.length ?? 0;

  return { signIn, methodCount, hasSecondFactor: methodCount > 0 };
}
