'use client';

import { useCallback, useEffect, useState } from 'react';
import { cancelAsk, listAsks, type AskSummary } from '@/lib/api/requests';

/**
 * The claims this account has sent (#465).
 *
 * Read once, on mount, for the same reason the ledger reads once: this is a short list of open
 * obligations, not a feed that has to stay live. A withdrawal updates the row in place from the
 * server's answer rather than refetching, so the list cannot flicker back to the state the customer
 * just acted on.
 *
 * `answered` is the loading flag rather than a stored phase: an empty array is a real answer ("no
 * claims"), and the absence of an answer is not.
 */
export interface UseClaimsReturn {
  claims: AskSummary[];
  loading: boolean;
  error: string | null;
  withdrawing: string | null;
  withdraw: (publicId: string) => void;
}

export function useClaims(): UseClaimsReturn {
  const [claims, setClaims] = useState<AskSummary[]>([]);
  const [answered, setAnswered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    listAsks()
      .then(({ requests }) => {
        if (!live) return;
        setClaims(requests);
        setAnswered(true);
      })
      .catch(() => {
        if (!live) return;
        setError('load');
        setAnswered(true);
      });

    return () => {
      live = false;
    };
  }, []);

  const withdraw = useCallback((publicId: string) => {
    setError(null);
    setWithdrawing(publicId);

    cancelAsk(publicId)
      .then(() => {
        // The server owns the state; this mirrors the one transition it just made.
        setClaims((current) =>
          current.map((claim) => (claim.publicId === publicId ? { ...claim, status: 'cancelled' } : claim))
        );
      })
      .catch(() => setError('withdraw'))
      .finally(() => setWithdrawing(null));
  }, []);

  return { claims, loading: !answered, error, withdrawing, withdraw };
}
