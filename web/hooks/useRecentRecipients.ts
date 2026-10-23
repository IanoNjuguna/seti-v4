'use client';

import { useEffect, useState } from 'react';
import { fetchRecentRecipients, refusalMessage } from '@/lib/api';
import type { RecentRecipient } from '@/lib/api';
import type { RecentRecipientsState } from './useRecentRecipients.types';

/**
 * The people this account has paid before, read once when the send flow opens.
 *
 * Follows `useHomeData`'s three rules for the same reasons: state is written only
 * from the request's callbacks (`react-hooks/set-state-in-effect` is an error in
 * this package), a slow answer cannot write to a dead component, and `loading` is
 * derived from whether the read has settled rather than stored beside it.
 *
 * The error is mapped through `refusalMessage`, so what the screen shows is our
 * sentence for the server's code and never the server's own words. A failed read
 * leaves the list empty: this block is a shortcut, and a shortcut that did not load
 * must not become a message about the customer's history.
 *
 * `read` exists because the list is only asked for while the recipient field is
 * empty and nobody has typed a name: the amount step and a typed handle both
 * render without it, and an account-scoped request nobody is looking at is a
 * request not worth making.
 */
export function useRecentRecipients(read: boolean): RecentRecipientsState {
  const [recipients, setRecipients] = useState<RecentRecipient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!read) return;

    let active = true;

    fetchRecentRecipients()
      .then((answer) => {
        if (!active) return;
        setRecipients(answer.recipients);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setRecipients([]);
        setError(refusalMessage(failure, 'account'));
      })
      .finally(() => {
        if (active) setSettled(true);
      });

    return () => {
      active = false;
    };
  }, [read]);

  return { recipients, error, loading: read && !settled };
}
