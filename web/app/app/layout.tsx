import type { Metadata } from 'next';
import './motion.css';
import { AppGate } from '@/components/app/AppGate';
import { PrivyAppProvider } from '@/components/providers/PrivyAppProvider';
import { AccountIdentityProvider } from '@/lib/account';
import { SessionProvider } from '@/lib/auth';

/**
 * The product app's layout.
 *
 * No font loading here: the root layout already provides the site's two families
 * and the app uses them as the system specifies — `font-sans` (Plus Jakarta
 * Sans) for body and UI, `font-brand` (Space Grotesk) for display sizes as the
 * Aeonik Pro substitute. Importing a third family for one segment would be a
 * third voice on one site.
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
    // Privy is outermost so the session (which may adopt a Privy session) and
    // everything below it can reach the SDK. It is a no-op wrapper when no app id
    // is configured, which is what keeps the `dev` sign-in path working.
    <PrivyAppProvider>
      <SessionProvider>
        <AccountIdentityProvider>
          <AppGate>{children}</AppGate>
        </AccountIdentityProvider>
      </SessionProvider>
    </PrivyAppProvider>
  );
}
