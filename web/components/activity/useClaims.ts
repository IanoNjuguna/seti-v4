'use client';

import { useCallback, useEffect, useState } from 'react';
import { cancelAsk, listAsks } from '@/lib/api/requests';
import { useSession } from '@/lib/auth';
import { CLAIMS_COPY } from './ActivityClaims.constants';
import { claimRows } from './claims';
import type { ClaimRowModel, UseClaimsReturn } from './ActivityClaims.types';

/**
 * The claims this account is waiting on (#465).
 *
 * `rows` is null until the first read answers, so the band never flashes a heading and then
 * fills. Nothing is fetched while signed out: a public read for a private list would be a request
 * the server refuses, and the page does not render the band in that state anyway.
 *
 * Cancelling is LOCAL after the server accepts it: the row is re-labelled `Withdrawn` from the
 * answer rather than by refetching the list, because a refetch would make a two-word change into a
 * page that blinks. If the server refuses, the row stays as it was and the reason is printed — a
 * claim that could not be cancelled must never look cancelled.
 */
export function useClaims(): UseClaimsReturn {
  const session = useSession();
  const [rows, setRows] = useState<ClaimRowModel[] | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status !== 'signed-in') return;

    let live = true;

    listAsks()
      .then((answer) => {
        if (live) setRows(claimRows(answer.requests));
      })
      .catch(() => {
        // A failed read is not an empty account: the band says nothing rather than "no claims".
        if (live) setRows([]);
      });

    return () => {
      live = false;
    };
  }, [session.status]);

  const cancel = useCallback((publicId: string) => {
    setError(null);
    setCancelling(publicId);

    cancelAsk(publicId)
      .then(() => {
        setRows((current) =>
          (current ?? []).map((row) =>
            row.publicId === publicId
              ? { ...row, state: 'cancelled', stateWord: CLAIMS_COPY.states.cancelled, cancellable: false }
              : row
          )
        );
      })
      .catch(() => setError(CLAIMS_COPY.cancelFailed))
      .finally(() => setCancelling(null));
  }, []);

  return { rows, cancelling, error, cancel };
}
