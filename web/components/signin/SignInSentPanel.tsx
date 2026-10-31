'use client';

import { Button, Input } from '@/components/ui';
import { SIGN_IN_SENT_COPY } from './SignInScreen.constants';
import { SignInFailure } from './SignInFailure';
import { SignInTextButton } from './SignInTextButton';
import type { SignInSentPanelProps } from './SignInScreen.types';

/**
 * What happens after the button: the address echoed back, the code, and the two ways
 * out of a code that never arrives.
 *
 * The address is echoed IN FULL and at full contrast, because the commonest failure
 * here is a typo, and a person who cannot see which address was used cannot tell that
 * from a slow email.
 *
 * Sign-in is an emailed one-time CODE, not a link (Privy's React SDK has no headless
 * magic-link login), so the copy says code and the field collects it — promising a
 * link would send the visitor looking for something that is not there.
 *
 * `resending` comes from the session (a real `sending` attempt) and swaps the re-send
 * control for the words "sending a new code…", so the control is not a dead link.
 *
 * `verifying` is the code button's own in-flight state, and it is a different wait
 * from `resending`: checking the code is the page's promise (`useSignInScreen`), not
 * the session's status. Both are drawn, on the control each one belongs to — before
 * this, pressing `Sign in` produced no feedback at all while the code was checked.
 */
export function SignInSentPanel({
  address,
  code,
  error,
  resending,
  verifying,
  onCodeChange,
  onSubmit,
  onResend,
  onUseAnotherAddress,
}: SignInSentPanelProps) {
  return (
    <div className="flex flex-col">
      <h1 className="font-brand text-heading-lg font-medium text-on-dark sm:text-display-md">
        {SIGN_IN_SENT_COPY.title}
      </h1>
      <p className="mt-5 text-body-lg text-on-dark-mute">
        {SIGN_IN_SENT_COPY.bodyPrefix}{' '}
        <span className="text-on-dark">{address}</span>. {SIGN_IN_SENT_COPY.bodySuffix}
      </p>

      {error ? (
        <div className="mt-6">
          <SignInFailure error={error} />
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <Input
          label={SIGN_IN_SENT_COPY.codeLabel}
          tone="dark"
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
        />
        <Button type="submit" variant="on-dark" fullWidth loading={verifying}>
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
