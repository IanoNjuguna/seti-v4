'use client';

import { useCallback, useRef, useState } from 'react';
import { fetchStatement, refusalMessage } from '@/lib/api';
import type { StatementFormat } from '@/lib/api';
import { saveStatement } from './statement.download';
import type { UseStatementDownloadReturn } from './Statement.types';

/**
 * One statement at a time: which format is being made, and what to say if it does
 * not arrive.
 *
 * Nothing runs on mount — a statement is made when the customer asks for one — so
 * there is no effect here and every state write sits in a promise callback.
 * `inFlight` is a ref rather than state because it guards re-entry within the same
 * render the press happened in, before React has re-rendered the controls into
 * their disabled form.
 *
 * A failure is mapped through the SAME refusal vocabulary the list uses, under a
 * statement's own flow (`lib/api/refusal`): a refused statement is told apart from
 * a refused list load by its words, and no second error type is introduced.
 */
export function useStatementDownload(): UseStatementDownloadReturn {
  const [pending, setPending] = useState<StatementFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const last = useRef<StatementFormat | null>(null);

  const run = useCallback((format: StatementFormat) => {
    if (inFlight.current) return;

    inFlight.current = true;
    last.current = format;
    setPending(format);
    setError(null);

    fetchStatement(format)
      .then((file) => saveStatement(file.blob, file.fileName))
      .catch((cause: unknown) => setError(refusalMessage(cause, 'statement')))
      .finally(() => {
        inFlight.current = false;
        setPending(null);
      });
  }, []);

  const retry = useCallback(() => {
    if (last.current) run(last.current);
  }, [run]);

  return { pending, error, download: run, retry };
}
