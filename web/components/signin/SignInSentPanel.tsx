'use client';

import { Button } from '@/components/ui';
import { SIGN_IN_SENT_COPY } from './SignInScreen.constants';
import { SignInFailure } from './SignInFailure';
import { SignInTextButton } from './SignInTextButton';
import { CodeCells } from './otp/CodeCells';
import { isComplete } from './otp/code.logic';
import type { SignInSentPanelProps } from './SignInScreen.types';

/**
 * The code screen, in the reference's shape: one instruction, the address it went to,
 * six cells, one control.
 *
 * ## The cells replace the field, and the auto-submit replaces the press
 *
 * Six digits arriving at once is not an ambiguity the person should have to resolve by
 * pressing something, so the sixth digit submits. The button stays for the case that
 * auto-submit cannot serve — a code that was refused — and it is disabled until there
 * are six digits, because a press with three of them can only produce a refusal.
 *
 * ## The address is echoed in full, at full contrast
 *
 * Unchanged from the previous screen, and still the reason it is here: the commonest
 * failure at this step is a typo in the address, and someone who cannot see which
 * address was used cannot tell that from a slow email.
 *
 * ## What is deliberately absent
 *
 * A "verified" state. The reference's final frame — a checkmark and the word Verified —
 * describes a flow that stays on the page after the code works. This one does not: the
 * session becomes `signed-in` and the app takes the viewport (`SignInHandoff`), so a
 * check here would be a frame nobody sees. The confirmation the customer gets is the
 * app opening, which is the stronger one.
 */
export function SignInSentPanel({
  address,
  code,
  error,
  resending,
  verifying,
  onCodeChange,
  onCodeComplete,
  onSubmit,
  onResend,
  onUseAnotherAddress,
}: SignInSentPanelProps) {
  const complete = isComplete(code);

  return (
    <div className="flex flex-col">
      {/* No heading (#567): the six cells say "code", and the line under them says where it went.
          `Enter the code.` above a row of six inputs was the route name again. */}
      <p className="text-body-md text-on-dark-mute">
        {SIGN_IN_SENT_COPY.sentTo} <span className="text-on-dark">{address}</span>
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-6">
        <CodeCells
          code={code}
          error={Boolean(error)}
          disabled={verifying}
          onCodeChange={onCodeChange}
          onComplete={onCodeComplete}
        />
        {/* Above the control it explains, the same rule the entry stage follows (#567). */}
        {error ? <SignInFailure error={error} /> : null}
        <Button type="submit" variant="on-dark" fullWidth loading={verifying} disabled={!complete}>
          {SIGN_IN_SENT_COPY.submit}
        </Button>
      </form>

      <p className="mt-5 text-body-sm text-on-dark-mute">
        {SIGN_IN_SENT_COPY.deliverabilityLead}{' '}
        <SignInTextButton onClick={onResend} disabled={resending}>
          {resending ? SIGN_IN_SENT_COPY.resending : SIGN_IN_SENT_COPY.resend}
        </SignInTextButton>
        {SIGN_IN_SENT_COPY.deliverabilityMiddle}{' '}
        <SignInTextButton onClick={onUseAnotherAddress}>
          {SIGN_IN_SENT_COPY.useAnother}
        </SignInTextButton>
        {SIGN_IN_SENT_COPY.deliverabilityTail}
      </p>
    </div>
  );
}
