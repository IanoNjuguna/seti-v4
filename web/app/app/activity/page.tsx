'use client';

import { useCallback, useState } from 'react';
import { ActivityList } from '@/components/activity/ActivityList';
import { ActivitySignedOut } from '@/components/activity/ActivitySignedOut';
import { ReceiptSheet } from '@/components/receipt/ReceiptSheet';
import { useSession } from '@/lib/auth';
import type { Transaction } from '@/lib/types';

/**
 * Activity: the full history, grouped by day, with each row opening its receipt.
 *
 * Two of the session's three states render the same screen: a confirmed account
 * gets the list — which owns its own loading, empty and failure states, because
 * those are facts about a history it is actually reading — and everybody else
 * gets the page's header with one sentence where the rows would be
 * (`ActivitySignedOut`). Both carry the page's own title, so the two cannot
 * disagree about what this screen is.
 *
 * The list is mounted ONLY for a confirmed account, which is what keeps an
 * account-scoped read from firing for a visitor. It is also why the row skeleton
 * that used to stand in for a restoring session is gone: it promised rows for an
 * account nobody had confirmed, and a restore that never answers would never pay
 * that promise off.
 *
 * The open row lives here rather than in the list: the sheet is a sibling of the
 * list, and a row that closed itself would have to reach back up to unmount it.
 * The closer is stable so the dialog's focus and scroll lock are established
 * once, on open, instead of on every render.
 */
export default function ActivityPage() {
  const session = useSession();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const closeReceipt = useCallback(() => setSelected(null), []);

  if (session.status !== 'signed-in') {
    return <ActivitySignedOut view={session.status} />;
  }

  return (
    <>
      <ActivityList onSelect={setSelected} />
      {selected ? (
        <ReceiptSheet transactionId={selected.id} onClose={closeReceipt} />
      ) : null}
    </>
  );
}
