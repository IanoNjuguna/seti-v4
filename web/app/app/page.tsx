'use client';

import { Button, StateMessage } from '@/components/ui';
import { BalanceCard } from '@/components/home/BalanceCard';
import { HomeActivity } from '@/components/home/HomeActivity';
import { HomeGreeting } from '@/components/home/HomeGreeting';
import { HomeLoading } from '@/components/home/HomeLoading';
import { QuickActions } from '@/components/home/QuickActions';
import { ScanPayCard } from '@/components/home/ScanPayCard';
import { SignInCard } from '@/components/auth/SignInCard';
import { useSession } from '@/lib/auth';
import { mapRecentToUiTransaction, useHomeData } from '@/hooks/useHomeData';

/**
 * Home: the balance first, then the things a money app is opened for — pay,
 * move money, review activity — then where the money actually goes.
 *
 * From `lg` up there are two columns: the account column, and a side column for
 * the settlement facts. Activity then spans the full width. Below `lg`
 * everything stacks in that reading order, so the money column always leads and
 * the scan entry point never ends up below the list.
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
        tone="alert"
        title="Could not load account"
        body={error}
        action={<Button onClick={refetch}>Try Again</Button>}
      />
    );
  }

  const transactions = (data?.recentTransactions ?? []).map(mapRecentToUiTransaction);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Single column on purpose: the app shell caps content at `max-w-2xl`, so a
          second column here squeezed the balance card until a 9-figure amount
          wrapped, and made the primary CTA the smallest thing on the card. The
          side facts read fine inline.

          The vertical rhythm is one ladder off `design/revolut.md`'s spacing
          scale, and the grouping is what makes it a rhythm rather than a stack of
          equal gaps: the greeting and the balance are one unit (`gap-4` = 16px,
          `spacing.lg`) because the line labels the card, then the three working
          sections sit one step apart (`gap-6` = 24px `spacing.xl`, or 32px
          `spacing.xxl` from `md` up). It used to be a flat 32px everywhere, which
          left the greeting floating away from the card it belongs to, and
          `HomeActivity` added its own 8px on top of that gap — the one step in
          the ladder that came from nowhere. */}
      <div className="flex flex-col gap-4">
        <HomeGreeting />
        <BalanceCard data={data} />
      </div>
      <QuickActions />
      <ScanPayCard />

      <HomeActivity transactions={transactions} />
    </div>
  );
}
