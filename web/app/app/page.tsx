'use client';

import { Button, StateMessage } from '@/components/ui';
import { BalanceCard } from '@/components/home/BalanceCard';
import { HomeActivity } from '@/components/home/HomeActivity';
import { HomeGreeting } from '@/components/home/HomeGreeting';
import { HomeLoading } from '@/components/home/HomeLoading';
import { QuickActions } from '@/components/home/QuickActions';
import { SignInCard } from '@/components/auth/SignInCard';
import { useSession } from '@/lib/auth';
import { mapRecentToUiTransaction, useHomeData } from '@/hooks/useHomeData';

/**
 * Home: the greeting, the balance, then what the account is opened for — pay,
 * move money, review activity — and where the money goes last.
 *
 * One column at every width (see the note in the body): the shell caps content
 * at `max-w-2xl`, so a second column here squeezed the balance until a 9-figure
 * amount wrapped.
 */
export default function HomePage() {
  const session = useSession();
  const { data, loading, error, refetch } = useHomeData(session.user?.id);

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
      {/* One column on purpose: the shell caps content at `max-w-2xl`, and a
          second column here squeezed the balance until a 9-figure amount wrapped.

          The rhythm is one ladder off `design/revolut.md`'s spacing scale,
          grouped so it reads as a rhythm: the greeting and the balance are one
          unit (`gap-4` = 16px `spacing.lg`) because the line labels the card,
          then each working section is one step apart (`gap-6` = 24px
          `spacing.xl`; 32px `spacing.xxl` from `md` up). Flat 32px left the
          greeting floating, and `HomeActivity` used to add its own 8px on top. */}
      <div className="flex flex-col gap-4">
        <HomeGreeting />
        <BalanceCard data={data} />
      </div>
      <QuickActions />

      <HomeActivity transactions={transactions} />
    </div>
  );
}
