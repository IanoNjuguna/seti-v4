import { ButtonLink, Text } from '@/components/ui';
import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { SIGN_IN_PROMPT_COPY } from '@/components/auth/SignInPrompt.constants';
import { SIGN_IN_PATH } from '@/lib/routes';
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
 * That sentence now carries the control that answers it (#561). It used to leave a
 * visitor reading `Sign in to see your activity.` with nothing to press, on a page
 * whose header pill is the only door — an instruction with no affordance, on the
 * one screen whose whole job is to show what an account would hold. The label is
 * `SIGN_IN_PROMPT_COPY.action`, the app's one spelling of the verb, and the
 * destination is `/signin` by the same reasoning `SignInPrompt` gives: the Terms
 * acceptance is displayed and given there, so no surface inside the app creates an
 * account it has no version to claim.
 *
 * The block is a column of `items-start`, not `fullWidth`: a 768px black bar under one short
 * sentence is a banner, and the control belongs on the sentence's own left edge, the same edge the
 * title and every row in this app share.
 *
 * The RESTORING state gets no control, and that is the rule the whole screen exists
 * to keep: telling somebody who is already signed in to sign in is the one failure a
 * gate may not commit, so while the app is still finding out who is here it says
 * `One moment…` and offers nothing.
 *
 * This screen says nothing about money in either state: no rows, no zero, no count
 * (an "0 transactions" line would be a figure a visitor could read as a fact about
 * an account).
 */
export function ActivitySignedOut({ view }: ActivitySignedOutProps) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <Text variant="section" as="h1">
          {ACTIVITY_COPY.title}
        </Text>
      </header>

      <div className="flex flex-col items-start gap-4">
        <Text variant="body" color="secondary" as="p">
          {view === 'anonymous' ? NO_ACCOUNT_COPY.anonymous('your activity') : NO_ACCOUNT_COPY.restoring}
        </Text>

        {view === 'anonymous' ? (
          <ButtonLink href={SIGN_IN_PATH} variant="primary">
            {SIGN_IN_PROMPT_COPY.action}
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
