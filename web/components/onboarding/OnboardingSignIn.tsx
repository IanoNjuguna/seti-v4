'use client';

import { SignInCard } from '@/components/auth/SignInCard';
import { useSession } from '@/lib/auth';

/**
 * Step one: sign in — the surface that already exists, unchanged.
 *
 * Deliberately a wrapper and not a re-implementation. Signing up and signing in are
 * the same action here (the account is created on first sign-in), and
 * `SignInCard` already owns the gate that matters most on this screen: the terms
 * checkbox, which keeps the sign-in button `disabled` until it is ticked, by mouse,
 * Enter or Space. A second sign-in UI for onboarding would be a second place for
 * that gate to be missing.
 */
export function OnboardingSignIn() {
  const session = useSession();

  return (
    <SignInCard
      onSignIn={() => void session.signIn()}
      error={session.error}
      source={session.source}
      pending={session.signingIn}
    />
  );
}
