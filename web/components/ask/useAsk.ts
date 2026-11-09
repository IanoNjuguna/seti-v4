'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { fetchAccountIdentity } from '@/lib/api/account';
import { claimLink, createAsk, type CreatedAsk } from '@/lib/api/requests';
import { useSession } from '@/lib/auth';
import { ASK_COPY, ASK_DEFAULT_EXPIRY_DAYS, ASK_REFUSALS, isValidAskAmount } from './ask.constants';
import type { AskDraft, AskPayee, AskPhase, UseAskReturn } from './ask.types';

const EMPTY: AskDraft = { payee: '', amount: '', memo: '', expiresInDays: ASK_DEFAULT_EXPIRY_DAYS };

/**
 * The ask form's state, and the one write it makes (#465).
 *
 * The payee defaults to the CALLER's own handle, because an ask is paid to the person asking. It is
 * still a choice rather than a constant: an account can hold a person handle and a business handle at
 * once, and the ask names whichever one it is being written for.
 *
 * THE PHASE IS DERIVED, never stored. This app's lint treats `setState` in an effect body as an error
 * (React Compiler rules), and the rule is right about the cause: a stored `'loading'` needed a write on
 * entry only to say what the absence of an answer already says. `payees === null` IS "the account read
 * has not answered yet", so there is no third state to get out of step.
 */
export function useAsk(): UseAskReturn {
  const session = useSession();
  const [draft, setDraft] = useState<AskDraft>(EMPTY);
  const [payees, setPayees] = useState<AskPayee[] | null>(null);
  const [created, setCreated] = useState<CreatedAsk | null>(null);
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status !== 'signed-in') return;

    let live = true;

    // Written from the callbacks only, never from the effect body: that is what keeps
    // this a subscription rather than a render loop.
    fetchAccountIdentity()
      .then((account) => {
        if (!live) return;
        const held = account.handles.map((handle) => ({ handle: handle.handle, name: handle.name }));
        setPayees(held);
        setDraft((current) => ({ ...current, payee: current.payee || held[0]?.handle || '' }));
      })
      .catch(() => {
        if (live) setPayees([]);
      });

    return () => {
      live = false;
    };
  }, [session.status]);

  const phase: AskPhase = created
    ? 'shared'
    : saving
      ? 'saving'
      : payees === null && session.status === 'signed-in'
        ? 'loading'
        : 'editing';

  const setAmount = useCallback((amount: string) => setDraft((d) => ({ ...d, amount })), []);
  const setMemo = useCallback((memo: string) => setDraft((d) => ({ ...d, memo })), []);
  const setPayee = useCallback((payee: string) => setDraft((d) => ({ ...d, payee })), []);
  const setExpiry = useCallback(
    (expiresInDays: number | null) => setDraft((d) => ({ ...d, expiresInDays })),
    []
  );

  const restart = useCallback(() => {
    setCreated(null);
    setLink('');
    setError(null);
    setDraft((d) => ({ ...EMPTY, payee: d.payee }));
  }, []);

  const submit = useCallback(() => {
    setError(null);
    setSaving(true);

    createAsk({
      destinationHandle: draft.payee,
      amount: draft.amount,
      memo: draft.memo.trim() || undefined,
      expiresInDays: draft.expiresInDays,
    })
      .then((answer) => {
        setCreated(answer.request);
        setLink(claimLink(answer.request.publicId, window.location.origin));
      })
      .catch((cause: unknown) => {
        const code = cause instanceof ApiError ? cause.code : undefined;
        setError((code && ASK_REFUSALS[code]) || ASK_COPY.errorTitle);
      })
      .finally(() => setSaving(false));
  }, [draft]);

  /*
   * The amount's shape, said out loud (#513).
   *
   * The keypad used to make a malformed amount impossible; a typed one was always possible, and it
   * was the server that refused it. With the grid gone, this is the only guard before the submit, so
   * it is two things: the button stays off for a figure that is not a number the service accepts,
   * and the figure itself says which figure that is, in the refusal's own words. A form that greys
   * its only action and explains nothing is the failure this is here to avoid.
   */
  const amountTyped = draft.amount.trim().length > 0;
  const amountValid = isValidAskAmount(draft.amount);

  return {
    phase,
    draft,
    payees: payees ?? [],
    created,
    link,
    error,
    amountError: amountTyped && !amountValid ? ASK_REFUSALS['amount-invalid'] : null,
    canSubmit:
      phase === 'editing' &&
      amountValid &&
      draft.payee.length > 0 &&
      (payees?.length ?? 0) > 0,
    setPayee,
    setAmount,
    setMemo,
    setExpiry,
    submit,
    restart,
  };
}
