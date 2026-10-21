'use client';

import { useSession } from '@/lib/auth';
import { PageBack } from '@/components/app/PageBack';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { Text } from '@/components/ui';
import { SAVE_COPY, SAVE_SIGNED_OUT_COPY } from './Save.constants';
import { SaveFlow } from './SaveFlow';

/**
 * `/app/save`'s one decision: is there an account to save with?
 *
 * Confirmed, `SaveFlow` mounts and the figures come up with it. Otherwise the
 * visitor gets the page's shape and a sign-in prompt — and not one account-scoped
 * request, because `SaveFlow` is never rendered and its hook never runs.
 *
 * Saving moves money out of a balance a visitor does not have, so the ask belongs
 * here rather than on the way to it.
 */
export function SaveScreen() {
  const session = useSession();

  if (session.status !== 'signed-in') {
    const restoring = session.status === 'restoring';

    return (
      <div className="flex flex-col gap-4">
        <PageBack />
        <Text variant="section" as="h1">
          {SAVE_COPY.title}
        </Text>

        {restoring ? (
          <Text variant="body" color="secondary" as="p">
            {NO_ACCOUNT_COPY.restoring}
          </Text>
        ) : (
          <SignInPrompt title={SAVE_SIGNED_OUT_COPY.title} body={SAVE_SIGNED_OUT_COPY.body} />
        )}
      </div>
    );
  }

  return <SaveFlow />;
}
