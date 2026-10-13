'use client';

import { useCallback, useState } from 'react';
import { Text } from '@/components/ui';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';

/**
 * Where to send money to — the body of `/app/deposit`.
 *
 * In a non-custodial app there is no "add money" — nothing is added, it arrives.
 * So this is a receive address, not a form: the user's own embedded wallet on
 * Tempo, with one instruction and a copy button.
 *
 * The address comes from the embedded wallet rather than an API call, because
 * the browser is the only side that knows it at the moment it matters (Privy
 * creates it at login, and `POST /auth/verify` registers that same address).
 *
 * This is a whole surface now, not a panel inside the balance card, so the page's
 * Back control is the way out — in every state, including the ones with no
 * address yet. Those states still render inside the same well: a receive address
 * that is still being found is not a reason to show a different surface.
 */
export function DepositPanel() {
  const { address, status } = useEmbeddedWallet();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [address]);

  const message =
    status === 'loading'
      ? 'Finding your wallet…'
      : address
        ? null
        : 'No wallet yet. Sign in with Privy and one is created for you.';

  return (
    <div className="rounded-md bg-surface-elevated p-4">
      {message ? (
        <p className="text-body-sm text-on-dark-mute">{message}</p>
      ) : (
        <>
          <Text variant="micro" as="p" color="inverse-muted">
            Send to this address
          </Text>
          <code className="mt-2 block break-all font-mono text-body-sm text-on-dark">
            {address}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-live="polite"
            className="mt-3 rounded-full bg-canvas-light px-5 py-2 text-body-sm font-semibold text-canvas-dark transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark/60"
          >
            {copied ? 'Copied' : 'Copy address'}
          </button>
        </>
      )}
    </div>
  );
}
