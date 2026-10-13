'use client';

import { Button, StateMessage } from '@/components/ui';
import type { PrivySignInErrorProps } from './PrivySignInError.types';

/**
 * Shown when Privy authenticated but the Seti exchange failed.
 *
 * Without this the user sits on a "Signing you in" state that can never finish
 * and never explains itself — and with no way out, because Privy still considers
 * them signed in. Both a retry and an escape are required.
 */
export function PrivySignInError({ message, onRetry, onSignOut }: PrivySignInErrorProps) {
  return (
    <div className="flex flex-col gap-4">
      <StateMessage tone="alert" title="Could not finish signing in" body={message} />
      <Button onClick={onRetry} fullWidth>
        Try again
      </Button>
      <Button onClick={onSignOut} variant="secondary" fullWidth>
        Sign out of Privy
      </Button>
    </div>
  );
}
