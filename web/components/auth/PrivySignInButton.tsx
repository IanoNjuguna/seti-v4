'use client';

import { usePrivy } from '@privy-io/react-auth';
import { Button, StateMessage } from '@/components/ui';
import { usePrivySessionExchange } from '@/hooks/usePrivySessionExchange';
import { PrivySignInError } from './PrivySignInError';

/**
 * Privy sign-in: the product path.
 *
 * A thin view over `usePrivySessionExchange`, which owns the token read, the
 * exchange with `POST /auth/verify`, and the retry policy. Only rendered when the
 * auth source is `privy`, so `usePrivy` always has a provider above it.
 */
export function PrivySignInButton() {
  const { ready, login, logout } = usePrivy();
  const { status, error, retry } = usePrivySessionExchange();

  if (status === 'failed' && error) {
    return <PrivySignInError message={error} onRetry={retry} onSignOut={() => void logout()} />;
  }

  if (status === 'exchanging') {
    return <StateMessage title="Signing you in" body="Finishing your session with Seti." />;
  }

  return (
    <Button onClick={() => void login()} loading={!ready} fullWidth>
      Continue with email
    </Button>
  );
}
