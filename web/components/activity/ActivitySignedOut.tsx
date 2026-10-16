import { Text } from '@/components/ui';
import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { ACTIVITY_COPY } from './Activity.constants';
import type { ActivitySignedOutProps } from './Activity.types';

/**
 * Activity with no account behind it — the DEMO state, and not an empty one.
 *
 * The screen keeps its own header, because the page's title is the shape of the
 * product: a visitor is here to see what the app does. What the rows would be is
 * one sentence (`NO_ACCOUNT_COPY`) — the account's history is not empty, it is
 * not known.
 *
 * That difference is the whole point of `restoring` getting its own line rather
 * than the skeleton it used to get. A skeleton here says "your data is coming",
 * which is a claim about an account nobody has confirmed yet — and if the
 * restore is slow, the claim is never paid off. This screen says nothing about
 * money in either state: no rows, no zero, no count (an "0 transactions" line
 * would be a figure a visitor could read as a fact about an account).
 */
export function ActivitySignedOut({ view }: ActivitySignedOutProps) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <Text variant="section" as="h1">
          {ACTIVITY_COPY.title}
        </Text>
      </header>

      <Text variant="body" color="secondary" as="p">
        {view === 'anonymous' ? NO_ACCOUNT_COPY.anonymous('your activity') : NO_ACCOUNT_COPY.restoring}
      </Text>
    </div>
  );
}
