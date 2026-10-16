import { Text } from '@/components/ui';
import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { BalanceCard } from './BalanceCard';
import { HomeGreeting } from './HomeGreeting';
import { HOME_PAGE_COPY } from './HomePage.constants';
import { QuickActions } from './QuickActions';
import type { HomeSignedOutProps } from './HomeSignedOut.types';

/**
 * Home for a visitor who is not signed in — the DEMO surface.
 *
 * The product's shape stays complete and visible, because that is the point of
 * showing the app to someone who has not signed up: the greeting line, the
 * balance card where the balance lives, the action strip, and the recent-activity
 * section under its own heading. What is missing is the DATA, and each place it
 * would be says one sentence instead (`NO_ACCOUNT_COPY`) — never a zero, never a
 * placeholder figure, never a skeleton implying something is arriving.
 *
 * The action strip stays TAPPABLE, deliberately. Hiding `Send` from a visitor
 * would hide the product's reason for existing; the gate belongs to the ACTION,
 * and it fires where the money flow is entered (`SignInPrompt` on `/app/send`).
 * Nothing here fetches: this component reads no account, because a visitor has
 * none — which is also why it can render on a first visit without a session.
 */
export function HomeSignedOut({ view }: HomeSignedOutProps) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-4">
        <HomeGreeting />
        <BalanceCard data={null} view={view} />
      </div>

      <QuickActions />

      <section aria-label={HOME_PAGE_COPY.activityTitle} className="flex flex-col gap-4">
        <Text variant="section" as="h2">
          {HOME_PAGE_COPY.activityTitle}
        </Text>
        <Text variant="body" color="secondary" as="p">
          {view === 'anonymous'
            ? NO_ACCOUNT_COPY.anonymous('your activity')
            : NO_ACCOUNT_COPY.restoring}
        </Text>
      </section>
    </div>
  );
}
