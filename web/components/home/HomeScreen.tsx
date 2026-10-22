'use client';

import { Button, StateMessage } from '@/components/ui';
import { useHomeData } from '@/hooks/useHomeData';
import { useHomeSummary } from '@/hooks/useHomeSummary';
import { useSession } from '@/lib/auth';
import { BalanceCard } from './BalanceCard';
import { HomeActions } from './HomeActions';
import { HomeLoading } from './HomeLoading';
import { HomeMerchants } from './HomeMerchants';
import { HomeSummary } from './HomeSummary';

/**
 * Home for a confirmed account: what you have, the two things the account is for,
 * and what the money did and where it went.
 *
 * THE ORDER is the argument of #94. The balance is the sentence a customer opens the
 * app to read, so it is a sentence (`You have`, then the figure). Then the two
 * actions, as buttons rather than icon wells, because they are the only doors on the
 * screen. Then the money over the period, from the reconciled analytics answer, and
 * then the merchants it went to — which is the part of Home this product can do that
 * a US fintech cannot, and it replaces the chronological list that used to sit here
 * looking like a bank statement.
 *
 * TWO reads, not one: the dashboard (the balance) and the analytics summary (the
 * period and the merchants). They are separate server answers and either can fail
 * alone, so each degrades on its own rather than taking the screen down: a failed
 * dashboard is the whole screen's error (`StateMessage`), a failed summary simply
 * leaves the two sections out — never a zero where a figure belongs.
 *
 * Rhythm: the balance card opens the screen and each working section follows a step
 * apart (`gap-6`; 32px from `md` up).
 */
export function HomeScreen() {
  const session = useSession();
  const { data, loading, error, refetch } = useHomeData(session.user?.id);
  const summary = useHomeSummary(session.user?.id);

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

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <BalanceCard data={data} view="signed-in" />

      <HomeActions />

      {summary.window ? <HomeSummary window={summary.window} currency={summary.currency} /> : null}

      {summary.merchants.length > 0 ? (
        <HomeMerchants merchants={summary.merchants} currency={summary.currency} />
      ) : null}
    </div>
  );
}
