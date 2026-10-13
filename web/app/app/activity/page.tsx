'use client';

import { useCallback, useState } from 'react';
import { ActivityList } from '@/components/activity/ActivityList';
import { SignInCard } from '@/components/auth/SignInCard';
import { HomeLoading } from '@/components/home/HomeLoading';
import { ReceiptSheet } from '@/components/receipt/ReceiptSheet';
import { useSession } from '@/lib/auth';
import type { Transaction } from '@/lib/types';

/**
 * Activity: the full history, grouped by day, with each row opening its receipt.
 *
 * The gate is the same three states the home screen uses, in the same order —
 * loading, signed out, signed in — so the two screens cannot disagree about what
 * "signed in" looks like.
 *
 * The open row lives here rather than in the list: the sheet is a sibling of the
 * list, and a row that closed itself would have to reach back up to unmount it.
 * The closer is stable so the dialog's focus and scroll lock are established once,
 * on open, instead of on every render.
 */
export default function ActivityPage() {
  const session = useSession();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const closeReceipt = useCallback(() => setSelected(null), []);

  if (session.status === 'loading') {
    return <HomeLoading />;
  }

  if (!session.isAuthenticated) {
    return (
      <SignInCard
        onSignIn={() => void session.signIn()}
        error={session.error}
        source={session.source}
        pending={session.signingIn}
      />
    );
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
