import type { Metadata } from 'next';
import { AppShell } from '@/components/app/AppShell';
import { PrivyAppProvider } from '@/components/providers/PrivyAppProvider';
import { SessionProvider } from '@/lib/auth';

/**
 * The product app's layout.
 *
 * No font loading here: the root layout already provides the site's two families
 * and the app uses them as the system specifies — `font-sans` (Plus Jakarta
 * Sans) for body and UI, `font-brand` (Space Grotesk) for display sizes as the
 * Aeonik Pro substitute. Importing a third family for one segment would be a
 * third voice on one site.
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
        <AppShell>{children}</AppShell>
      </SessionProvider>
    </PrivyAppProvider>
  );
}
