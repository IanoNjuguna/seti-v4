import type { Metadata } from 'next';
import { Onboarding } from '@/components/onboarding/Onboarding';

/**
 * `/app/onboarding` — the four steps, behind the gate.
 *
 * The gate renders it WITHOUT the app shell, which is why this page adds no chrome
 * of its own: no nav, no back control to a surface the account cannot reach yet.
 * A private URL, not a page to be found by anything.
 */
export const metadata: Metadata = {
  title: 'Set up your Seti account',
  description: 'Claim your name, and choose how you use Seti.',
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <Onboarding />;
}
