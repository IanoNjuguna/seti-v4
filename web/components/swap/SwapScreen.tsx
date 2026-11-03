'use client';

import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { PageBack } from '@/components/app/PageBack';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { Text } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { SWAP_FORM_COPY, SWAP_SIGNED_OUT_COPY } from './SwapForm.constants';
import { SwapForm } from './SwapForm';

/**
 * `/app/swap`'s one decision: is there an account to swap with?
 *
 * Confirmed, the form mounts and everything it needs comes up with it. Otherwise the
 * visitor gets the page's shape and a sign-in prompt, and not one account-scoped request,
 * because the form is never rendered and neither of its hooks runs.
 *
 * A swap moves money out of a balance a visitor does not have, so the ask belongs here
 * rather than on the way to it. The branch is `status !== 'signed-in'` so TypeScript
 * narrows the other side to the two states a sign-in prompt can render.
 */
export function SwapScreen() {
  const session = useSession();

  if (session.status !== 'signed-in') {
    const restoring = session.status === 'restoring';

    return (
      <div className="flex flex-col gap-4">
        <PageBack />
        <Text variant="section" as="h1">
          {SWAP_FORM_COPY.title}
        </Text>

        {restoring ? (
          <Text variant="body" color="secondary" as="p">
            {NO_ACCOUNT_COPY.restoring}
          </Text>
        ) : (
          <SignInPrompt title={SWAP_SIGNED_OUT_COPY.title} body={SWAP_SIGNED_OUT_COPY.body} />
        )}
      </div>
    );
  }

  return <SwapForm />;
}
