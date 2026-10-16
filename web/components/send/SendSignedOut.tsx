import { Text } from '@/components/ui';
import { PageBack } from '@/components/app/PageBack';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { SEND_FLOW_COPY, SEND_SIGNED_OUT_COPY } from './Send.constants';
import type { SendSignedOutProps } from './SendSignedOut.types';

/**
 * `/app/send` with no account behind it.
 *
 * The page keeps its shape — Back, its title, the place the flow opens — and the
 * FLOW is what the visitor does not get: the recipient question is not asked of
 * somebody who cannot send, so the sign-in prompt stands where step one would
 * have been. This is the whole of "gate the action, not the surface": `Send` on
 * Home stays visible and tappable, and the ask happens at the moment sending
 * would have started.
 *
 * `restoring` gets the shared "one moment" line rather than the prompt, because
 * the app does not yet know whether anyone is signed in — and a skeleton here
 * would promise a flow to somebody who may be nobody.
 */
export function SendSignedOut({ view }: SendSignedOutProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageBack />
      <Text variant="section" as="h1">
        {SEND_FLOW_COPY.title}
      </Text>

      {view === 'restoring' ? (
        <Text variant="body" color="secondary" as="p">
          {NO_ACCOUNT_COPY.restoring}
        </Text>
      ) : (
        <SignInPrompt title={SEND_SIGNED_OUT_COPY.title} body={SEND_SIGNED_OUT_COPY.body} />
      )}
    </div>
  );
}
