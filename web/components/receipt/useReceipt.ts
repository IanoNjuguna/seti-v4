'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchReceipt } from '@/lib/api';
import type { ReceiptDocument } from '@/lib/api';
import type { UseReceiptReturn } from './Receipt.types';

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

/**
 * The receipt for one row, fetched when the sheet opens.
 *
 * `loading` is derived from the two things that can be true of a request — no
 * document yet, no failure yet — rather than stored, so a fast response can never
 * flash a skeleton after the document has arrived. State is written only from the
 * request's callbacks, and the `active` guard stops a receipt that resolves after
 * the sheet closes from writing to a dead component.
 */
export function useReceipt(transactionId: string): UseReceiptReturn {
  const [receipt, setReceipt] = useState<ReceiptDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    fetchReceipt(transactionId)
      .then((document) => {
        if (!active) return;
        setReceipt(document);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setReceipt(null);
        setError(toMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [transactionId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setReceipt(null);
    setAttempt((previous) => previous + 1);
  }, []);

  return { receipt, loading: receipt === null && error === null, error, retry };
}
