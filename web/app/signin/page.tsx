import type { Metadata } from 'next';
import { PrivyAppProvider } from '@/components/providers/PrivyAppProvider';
import { SignInScreen } from '@/components/signin/SignInScreen';
import { SessionProvider } from '@/lib/auth';

/**
 * Sign in — `/signin`, the product's front door.
 *
 * A TOP-LEVEL route, not a screen of the app: no rail, no bottom bar, nothing of
 * the app chrome around it. A bank does not put its front door inside a room — and
 * the app's sign-in wall, which lived inside the app's own chrome on `/app/profile`,
 * was exactly that.
 *
 * ## The ambient field lives in a PANEL now, not behind the page
 *
 * This route used to wear `LandingBackdrop`, the landing page's whole-page field, so
 * the door read as the same product as the page that sent the visitor here. It still
 * does, but the field moved: the page is a split, and the field is inside the right
 * panel where it has an edge, a drift and a single object floating in it. A fixed
 * full-viewport layer under a two-column composition would light the form column too,
 * and the form is the one place on this page that must stay plain.
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
      {/* No padding and no centring here: the split owns its own gutters, and the
          ambient panel has to reach the viewport edge to have an edge at all. */}
      <main className="relative z-10 flex flex-1">
        <PrivyAppProvider>
          <SessionProvider>
            <SignInScreen />
          </SessionProvider>
        </PrivyAppProvider>
      </main>
    </div>
  );
}
