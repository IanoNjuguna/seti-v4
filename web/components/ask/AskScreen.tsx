'use client';

import { Button, Skeleton, StateMessage, Text } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { AskDetails } from './AskDetails';
import { AskFigure } from './AskFigure';
import { AskResult } from './AskResult';
import { ASK_COPY } from './ask.constants';
import { useAsk } from './useAsk';

/**
 * Ask for money — `/app/ask` (#465).
 *
 * Three shapes, and the screen decides between them once: nothing to ask to, the form, and the link
 * that came back. A signed-out visitor and an account with no name are both told what is missing
 * rather than shown a form they cannot submit — the rule the rest of the app follows, and the reason
 * the payee is a NAME rather than an address: a person paying a person uses a username.
 *
 * The ask is created on submit and not before: the record holds the amount, the memo and the deadline,
 * so there is nothing to save twice and no draft to keep.
 */
export function AskScreen() {
  const session = useSession();
  const ask = useAsk();

  if (session.status !== 'signed-in') {
    return (
      <StateMessage
        variant="empty"
        title={ASK_COPY.signedOutTitle}
        body={ASK_COPY.signedOutBody}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Text variant="section" as="h1">
          {ASK_COPY.title}
        </Text>
        <Text variant="micro" as="p" color="secondary">
          {ASK_COPY.subtitle}
        </Text>
      </div>

      {ask.phase === 'loading' ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {ask.phase !== 'loading' && ask.payees.length === 0 ? (
        <StateMessage
          variant="empty"
          title={ASK_COPY.noHandleTitle}
          body={ASK_COPY.noHandleBody}
        />
      ) : null}

      {ask.phase === 'shared' && ask.created ? (
        <AskResult created={ask.created} link={ask.link} onAnother={ask.restart} />
      ) : null}

      {ask.phase !== 'shared' && ask.phase !== 'loading' && ask.payees.length > 0 ? (
        <div className="flex flex-col gap-6">
          <AskFigure
            amount={ask.draft.amount}
            disabled={ask.phase === 'saving'}
            onAmount={ask.setAmount}
            error={ask.error}
          />

          <AskDetails
            memo={ask.draft.memo}
            expiresInDays={ask.draft.expiresInDays}
            disabled={ask.phase === 'saving'}
            payees={ask.payees}
            payee={ask.draft.payee}
            onMemo={ask.setMemo}
            onExpiry={ask.setExpiry}
            onPayee={ask.setPayee}
          />

          <Button
            variant="primary"
            fullWidth
            disabled={!ask.canSubmit}
            onClick={ask.submit}
          >
            {ask.phase === 'saving' ? ASK_COPY.saving : ASK_COPY.submit}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
