'use client';

import { useCallback, useState } from 'react';
import { usePayMerchant } from '@/hooks/usePayMerchant';
import { useSession } from '@/lib/auth';
import { looksLikeAddress, validateRecipient } from '@/lib/pay/validate-transfer';
import type { RecipientKind } from './RecipientStep';
import { useResolvedRecipient } from './useResolvedRecipient';
import type { SendFlowInput, UseSendFlowReturn } from './SendFlow.types';

/**
 * The flow's state, and every decision it makes — in a hook rather than in the
 * component, so the component is the shape of the flow and nothing else.
 *
 * The flow asks ONE question and mounts one of two amount steps from the answer.
 * The account's machinery (the name resolver, the fee preview, the wallet) is
 * created here, which is safe because `SendScreen` mounts this only once a session
 * is confirmed: the hooks never exist for a visitor.
 *
 * `focusAmount` starts true when the link already named the payee, and is turned on
 * by a tap on someone paid before (#99). Both are the same fact — the payee is
 * known, so the amount is the only thing left — and both leave the amount EMPTY:
 * nothing in this hook ever writes a figure the customer did not type.
 */
export function useSendFlow({ linked }: SendFlowInput): UseSendFlowReturn {
  const [kind, setKind] = useState<RecipientKind>('name');
  const [typed, setTyped] = useState('');
  const [recipient, setRecipient] = useState<string | null>(linked);
  const [error, setError] = useState<string | null>(null);
  const [focusAmount, setFocusAmount] = useState(linked !== null);

  const session = useSession();
  const isAddress = recipient !== null && looksLikeAddress(recipient);
  // Only a NAME is looked up: an address is signed as it stands, and a name is
  // resolved once, by the server, into the person or the merchant it belongs to.
  const resolved = useResolvedRecipient(!isAddress ? recipient : null);
  const merchant = resolved.status === 'business' ? recipient ?? undefined : undefined;
  const payment = usePayMerchant(session.user?.id ?? '', merchant);

  const onSubmitRecipient = useCallback(() => {
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
  }, [kind, typed]);

  const onBackToWho = useCallback(() => {
    setRecipient(null);
    setTyped('');
    setError(null);
    setFocusAmount(false);
  }, []);

  /**
   * A repeat: the payee is filled and the amount step is entered, with the cursor
   * in the amount field. The target is a name or an address — the same string a
   * typed one would be — so it goes through the SAME resolution and the SAME
   * preview, fee and signature path as any other send. No amount is carried.
   */
  const onPickRecent = useCallback((target: string) => {
    setError(null);
    setRecipient(target);
    setFocusAmount(true);
  }, []);

  return {
    kind,
    typed,
    error,
    recipient,
    isAddress,
    resolved,
    payment,
    focusAmount,
    onChangeKind: setKind,
    onChangeTyped: setTyped,
    onSubmitRecipient,
    onBackToWho,
    onPickRecent,
  };
}
