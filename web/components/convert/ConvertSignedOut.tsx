import { PageBack } from '@/components/app/PageBack';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { Text } from '@/components/ui';
import { CONVERT_COPY, CONVERT_SIGNED_OUT_COPY } from './Convert.constants';

export interface ConvertSignedOutProps {
  /** `restoring` is the app still deciding; anything else is a visitor. */
  view: 'restoring' | 'signed-out';
}

/**
 * `/app/convert` with no account behind it.
 *
 * The page keeps its shape and the FLOW is what a visitor does not get: converting
 * moves money out of a wallet they do not have yet, so the sign-in prompt stands
 * where the pair would have been. The tile on Home stays tappable — the ask
 * belongs at the moment the action would start, not on the way to it.
 */
export function ConvertSignedOut({ view }: ConvertSignedOutProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageBack />
      <Text variant="section" as="h1">
        {CONVERT_COPY.title}
      </Text>

      {view === 'restoring' ? (
        <Text variant="body" color="secondary" as="p">
          {NO_ACCOUNT_COPY.restoring}
        </Text>
      ) : (
        <SignInPrompt
          title={CONVERT_SIGNED_OUT_COPY.title}
          body={CONVERT_SIGNED_OUT_COPY.body}
        />
      )}
    </div>
  );
}
