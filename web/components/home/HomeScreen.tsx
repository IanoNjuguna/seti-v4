'use client';

import { Button, StateMessage } from '@/components/ui';
import { useHomeData, mapRecentToUiTransaction } from '@/hooks/useHomeData';
import { useSession } from '@/lib/auth';
import { BalanceCard } from './BalanceCard';
import { HomeActivitySection } from './HomeActivitySection';
import { HomeGreeting } from './HomeGreeting';
import { HomeLoading } from './HomeLoading';
import { QuickActions } from './QuickActions';

/**
 * Home for a confirmed account: the greeting, the balance, then what the account
 * is opened for — pay, move money, review activity — and where the money went
 * last.
 *
 * This is the file the `/app` page renders once there IS an account. It reads the
 * dashboard with the account's own id, so the account-scoped request only exists
 * on this side of the decision: a visitor never reaches a line of it (see
 * `HomeSignedOut`). The rhythm is one ladder off `design/revolut.md`'s spacing
 * scale: the greeting and the balance are one unit (`gap-4` — the line labels the
 * card), then each working section is one step apart (`gap-6`; 32px from `md` up).
 */
export function HomeScreen() {
  const session = useSession();
  const { data, loading, error, refetch } = useHomeData(session.user?.id);

  if (loading && !data) {
    return <HomeLoading />;
  }

  if (error && !data) {
    return (
      <StateMessage
        variant="failure"
        padding="sm"
        title="Could not load account"
        body={error}
        action={<Button onClick={refetch}>Try Again</Button>}
      />
    );
  }

  const transactions = (data?.recentTransactions ?? []).map(mapRecentToUiTransaction);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-4">
        <HomeGreeting />
        <BalanceCard data={data} view="signed-in" />
      </div>

      <QuickActions />

      <HomeActivitySection transactions={transactions} />
    </div>
  );
}
