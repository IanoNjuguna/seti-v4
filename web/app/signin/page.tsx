import type { Metadata } from 'next';
import { LandingBackdrop } from '@/app/components/landing/LandingBackdrop';
import { PrivyAppProvider } from '@/components/providers/PrivyAppProvider';
import { SignInScreen } from '@/components/signin/SignInScreen';
import { SessionProvider } from '@/lib/auth';

/**
 * Sign in — `/signin`, the product's front door.
 *
 * A TOP-LEVEL route, not a screen of the app: no rail, no bottom bar, nothing of
 * the app chrome around it, and it wears the landing page's own ambient field
 * (`LandingBackdrop`) so it reads as the same product as the page that sent the
 * visitor here. A bank does not put its front door inside a room — and the app's
 * sign-in wall, which lived inside the app's own chrome on `/app/profile`, was
 * exactly that.
 *
 * The providers are the app shell's, nested the same way for the same reason
 * (`app/app/layout.tsx`): Privy outermost, because the session may adopt a Privy
 * session and its headless email flow reads the SDK. `PrivyAppProvider` is a no-op
 * wrapper with no app id configured, which is what keeps the `dev` source working
 * on a machine with no Privy app. Nothing else of the shell is here — no
 * `AccountIdentityProvider` (this page has no handles) and no `AppGate` (there is
 * nothing to gate; a visitor is the expected arrival).
 */
export const metadata: Metadata = {
  title: 'Sign in · Seti',
  description: 'Sign in to Seti with your email. No password. We email you a code.',
};

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <LandingBackdrop />

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-[var(--band-pad-block)]">
        <PrivyAppProvider>
          <SessionProvider>
            <SignInScreen />
          </SessionProvider>
        </PrivyAppProvider>
      </main>
    </div>
  );
}
