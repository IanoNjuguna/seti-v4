'use client';

import { useState } from 'react';
import { usePayMerchant } from '@/hooks/usePayMerchant';
import { useSession } from '@/lib/auth';
import { looksLikeAddress, validateRecipient } from '@/lib/pay/validate-transfer';
import { type RecipientKind } from './RecipientStep';
import { SendFrame } from './SendFrame';
import { SendSteps } from './SendSteps';
import { useResolvedRecipient } from './useResolvedRecipient';
import type { SendFlowProps } from './SendFlow.types';

/**
 * The flow itself: the recipient question, the amount step, and the account's
 * machinery behind them.
 *
 * It owns the flow's state and nothing about the session — `SendScreen` mounts it
 * only once the session is confirmed, so every hook below exists only for a
 * customer who has an account. That is what makes "a visitor fires no
 * account-scoped request" structural rather than a set of guards: the hooks are
 * never rendered at all.
 */
export function SendFlow({ linked }: SendFlowProps) {
  // A deep link already names the recipient; nothing is asked twice.
  const [kind, setKind] = useState<RecipientKind>('name');
  const [typed, setTyped] = useState('');
  const [recipient, setRecipient] = useState<string | null>(linked);
  const [error, setError] = useState<string | null>(null);

  const session = useSession();
  const isAddress = recipient !== null && looksLikeAddress(recipient);
  // Only a NAME is looked up: an address is signed as it stands, and a name is
  // resolved once, by the server, into the person or the merchant it belongs to.
  const resolved = useResolvedRecipient(!isAddress ? recipient : null);
  const merchant = resolved.status === 'business' ? recipient ?? undefined : undefined;
  const payment = usePayMerchant(session.user?.id ?? '', merchant);

  const submitRecipient = () => {
    const value = typed.trim();
    if (!value) return;

    if (kind === 'address') {
      const check = validateRecipient(value);
      if (!check.ok) {
        setError(check.error);
        return;
      }
    }

    setError(null);
    setRecipient(value);
  };

  const backToWho = () => {
    setRecipient(null);
    setTyped('');
    setError(null);
  };

  return (
    <SendFrame current={recipient !== null ? 1 : 0}>
      <SendSteps
        kind={kind}
        typed={typed}
        error={error}
        recipient={recipient}
        isAddress={isAddress}
        resolved={resolved}
        payment={payment}
        onChangeKind={setKind}
        onChangeTyped={setTyped}
        onSubmitRecipient={submitRecipient}
        onBackToWho={backToWho}
      />
    </SendFrame>
  );
}
