'use client';

import { SignInCard } from '@/components/auth/SignInCard';
import { useSession } from '@/lib/auth';

/**
 * Step one: sign in — the app's standard signed-out card, which points at `/signin`.
 *
 * Deliberately a wrapper and not a re-implementation. Signing up and signing in are
 * the same action here (the account is created on first sign-in), and the terms gate
 * that belongs on that action lives at `/signin`, with the control that takes it. A
 * second sign-in UI inside onboarding would be a second place for the gate to be
 * missing, and a second front door.
 */
export function OnboardingSignIn() {
  const session = useSession();

  return <SignInCard error={session.error} />;
}
