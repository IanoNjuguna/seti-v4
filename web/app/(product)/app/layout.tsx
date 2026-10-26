import type { Metadata } from 'next';
import './motion.css';
import { AppGate } from '@/components/app/AppGate';
import { AccountIdentityProvider } from '@/lib/account';
import { SessionProvider } from '@/lib/auth';
import { AmountPrivacyProvider } from '@/lib/privacy/amount-privacy.context';

/**
 * The product app's layout.
 *
 * No font loading here: the root layout already provides the site's two families
 * and the app uses them as the system specifies — `font-sans` (Poppins) for
 * body and UI, `font-brand` (Poppins) for display sizes, and `font-mono`
 * (JetBrains Mono) for every figure, address and hash. Importing a third family
 * for one segment would be a third voice on one site.
 *
 * The providers are nested outermost-first: Privy (the SDK the session may adopt
 * a token from), then the session, then the account identity (which needs the
 * session to know WHOSE handles to read), then the gate (which needs all three).
 * `AppGate` owns the shell rather than the layout, because the one route that
 * must render without the app's nav is the onboarding wizard inside this tree.
 */

export const metadata: Metadata = {
  title: 'Seti — Account',
  description: 'Your Seti balance, payments and activity.',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // Privy is mounted once, above this route group, in `(product)/layout.tsx`:
    // one instance for sign-in and the app it signs into (#249). Session and
    // everything below it can still reach the SDK, and it is still a no-op
    // wrapper when no app id is configured, which keeps `dev` sign-in working.
      <SessionProvider>
        <AccountIdentityProvider>
          {/*
            * Inside the providers that establish WHO is here, outside the gate that
            * decides whether the app renders: the amount privacy flag belongs to the
            * session, survives navigation between `/app` routes, and resets on reload
            * because nothing is stored (#135).
            */}
          <AmountPrivacyProvider>
            <AppGate>{children}</AppGate>
          </AmountPrivacyProvider>
        </AccountIdentityProvider>
      </SessionProvider>
  );
}
