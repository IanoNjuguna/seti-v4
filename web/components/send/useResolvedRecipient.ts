'use client';

import { useEffect, useState } from 'react';
import { ApiError, resolveHandle } from '@/lib/api';
import type { HandleIdentity } from '@/lib/api';

/**
 * What a typed name turned out to be.
 *
 * `person` and `business` are the same identity shape — a name is one kind of
 * signed handle and `kind` is only a mode — but they are different FLOWS: a
 * person's handle is paid through Send, a merchant's is priced against its
 * business profile (`merchantId`). The flow asks the server once and mounts the
 * right one.
 */
export type ResolvedRecipient =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'person'; identity: HandleIdentity }
  | { status: 'business'; identity: HandleIdentity }
  | { status: 'failed'; message: string };

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Could not look that name up. Try again in a moment.';
}

/**
 * Resolve a name through the ONE resolver, and say which flow it belongs to.
 *
 * Nothing is parsed here: a username, a business name, a `seti://` link or a
 * platform id all go to `GET /handles/resolve` verbatim and the backend decides
 * what they are — parsing in the client would be a second implementation of a rule
 * the server owns.
 *
 * State is written only from the promise callbacks (`react-hooks/set-state-in-
 * effect` is an error in this package), and a resolution in flight is `loading`
 * rather than the previous answer, so the flow cannot mount the wrong branch for
 * a frame while a second name resolves.
 */
export function useResolvedRecipient(name: string | null): ResolvedRecipient {
  const [result, setResult] = useState<ResolvedRecipient>({ status: 'idle' });

  useEffect(() => {
    if (!name) return;

    let active = true;

    resolveHandle(name)
      .then((answer) => {
        if (!active) return;
        const merchant = answer.handle.kind === 'business' && answer.handle.merchantId;
        setResult(
          merchant
            ? { status: 'business', identity: answer.handle }
            : { status: 'person', identity: answer.handle }
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResult({ status: 'failed', message: toMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [name]);

  return name ? result : { status: 'idle' };
}
