'use client';

import { Button, StateMessage } from '@/components/ui';
import { PrivySignInButton } from './PrivySignInButton';

export interface SignInCardProps {
  onSignIn: () => void;
  error: string | null;
  /** Which path this build uses, shown so a local build is not mistaken for real auth. */
  source: 'privy' | 'dev';
  pending: boolean;
}

/**
 * The signed-out state of the app.
 *
 * The source is named on the screen on purpose: a `dev` session is a local
 * shortcut, and a screenshot of it should never be mistaken for a real sign-in.
 */
export function SignInCard({ onSignIn, error, source, pending }: SignInCardProps) {
  return (
    <div className="flex flex-col gap-4">
      <StateMessage
        title="Sign in to Seti"
        body="Your balance and payments are tied to your account."
      />
      {source === 'privy' ? (
        <PrivySignInButton />
      ) : (
        <Button onClick={onSignIn} loading={pending} fullWidth>
          Sign in
        </Button>
      )}
      {source === 'dev' ? (
        <p className="text-body-sm text-mute">
          Local development session. Needs
          <code className="mx-1 rounded-md bg-surface-soft px-1">DEV_BYPASS_AUTH=true</code>
          and
          <code className="mx-1 rounded-md bg-surface-soft px-1">NODE_ENV=development</code>
          in <code className="rounded-md bg-surface-soft px-1">backend/.env</code> — and a backend
          started <em>after</em> they were added, because it reads that file once at boot.
        </p>
      ) : null}
      {error ? (
        <StateMessage tone="alert" title="Could not sign in" body={error} />
      ) : null}
    </div>
  );
}
