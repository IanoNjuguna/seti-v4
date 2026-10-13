'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';
import { PRIVY_APP_ID, PRIVY_CONFIG } from './PrivyAppProvider.constants';
import { PrivyTokenBridge } from './PrivyTokenBridge';

/**
 * Mounts the Privy SDK above the product app.
 *
 * Renders children untouched when no app id is configured, so the `dev` sign-in
 * path keeps working on a machine with no Privy app — and so that a component
 * calling `usePrivy` is only ever rendered when a provider is actually present
 * (`resolveAuthSource` picks `privy` only when the app id exists).
 */
export function PrivyAppProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={PRIVY_CONFIG}>
      <PrivyTokenBridge>{children}</PrivyTokenBridge>
    </PrivyProvider>
  );
}
