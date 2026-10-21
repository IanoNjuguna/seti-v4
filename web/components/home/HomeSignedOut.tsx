import { Text } from '@/components/ui';
import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { BalanceCard } from './BalanceCard';
import { HomeActions } from './HomeActions';
import { HomeGreeting } from './HomeGreeting';
import { HOME_PAGE_COPY } from './HomePage.constants';
import type { HomeSignedOutProps } from './HomeSignedOut.types';

/**
 * Home for a visitor who is not signed in — the DEMO surface.
 *
 * The product's shape stays complete and visible, because that is the point of
 * showing the app to someone who has not signed up: the greeting line, the balance
 * card where the balance lives, the two actions, and the section where the
 * merchants would be. What is missing is the DATA, and each place it would be says
 * one sentence instead (`NO_ACCOUNT_COPY`) — never a zero, never a placeholder
 * figure, never a skeleton implying something is arriving.
 *
 * No period row for a visitor: `Last 30 days` over a figure would be a measurement
 * of an account that does not exist, and the one number on this screen that must
 * never be invented is a movement of money.
 *
 * The actions stay TAPPABLE, deliberately. Hiding `Pay` from a visitor would hide
 * the product's reason for existing; the gate belongs to the ACTION, and it fires
 * where the money flow is entered (`SignInPrompt` on `/app/send`). Nothing here
 * fetches: a visitor has no account to read.
 */
export function HomeSignedOut({ view }: HomeSignedOutProps) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-4">
        <HomeGreeting />
        <BalanceCard data={null} view={view} />
      </div>

      <HomeActions />

      {/*
        * Rendered only once the session has ANSWERED. While it is restoring this
        * screen says one thing (the balance card's line) and promises nothing else:
        * `design-enforcement` is explicit that a surface with no confirmed account
        * behind it invents nothing, and a row skeleton here would claim a history is
        * coming for an account nobody has confirmed yet.
        */}
      {view === 'anonymous' ? (
        <section aria-label={HOME_PAGE_COPY.merchantsTitle} className="flex flex-col gap-4">
          <Text variant="section" as="h2">
            {HOME_PAGE_COPY.merchantsTitle}
          </Text>
          <Text variant="body" color="secondary" as="p">
            {NO_ACCOUNT_COPY.anonymous('your activity')}
          </Text>
        </section>
      ) : null}
    </div>
  );
}
