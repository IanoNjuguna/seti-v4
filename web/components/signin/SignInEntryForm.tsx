'use client';

import { Button, Input } from '@/components/ui';
import { TermsAcceptance } from '@/components/auth/TermsAcceptance';
import { SIGN_IN_COPY } from './SignInScreen.constants';
import { SignInDevPreview } from './SignInDevPreview';
import { SignInFailure } from './SignInFailure';
import type { SignInEntryFormProps } from './SignInScreen.types';

/**
 * The front door: the one instruction, one field, the consent, one button.
 *
 * The type is the landing page's own — `font-brand` at `heading-lg` stepping to
 * `display-md` (the closing band's headline size) with the lede at `body-lg` in
 * `on-dark-mute`, exactly the hero's pair. The display line is raw markup rather than
 * `Text` because the system's display sizes have no `Text` variant; `HeroCopy` and
 * `ClosingSection` do the same for the same reason.
 *
 * The consent is the app's own `TermsAcceptance` control in its `dark` tone, not a
 * second statement written for this page: sign-in here creates the account, so the
 * terms are accepted BEFORE the request that can create one, and the sentence the
 * customer agrees to exists in exactly one place. It sits between the field and the
 * button because the gate belongs on the control that acts — `Button` is genuinely
 * `disabled` until it is ticked, and the control's own hint says why while it is not.
 *
 * The button is NOT disabled for an empty address: only the consent gates it, and the
 * session already answers a missing address with a plain sentence in the failure block
 * directly above the button. `noValidate` keeps the browser's own bubble out of it, so
 * the reason a press did not work is always Seti's sentence in Seti's language.
 */
export function SignInEntryForm({
  address,
  error,
  sending,
  accepted,
  previewAvailable,
  onAddressChange,
  onAcceptChange,
  onSubmit,
  onPreviewSent,
}: SignInEntryFormProps) {
  return (
    <div className="flex flex-col">
      <h1 className="font-brand text-heading-lg font-medium text-on-dark sm:text-display-md">
        {SIGN_IN_COPY.title}
      </h1>
      <p className="mt-5 text-body-lg text-on-dark-mute">{SIGN_IN_COPY.lede}</p>

      {/* Above the button, so the reason and the thing to press are adjacent. */}
      {error ? (
        <div className="mt-6">
          <SignInFailure message={error} />
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-5">
        <Input
          label={SIGN_IN_COPY.emailLabel}
          tone="dark"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
        />

        <TermsAcceptance tone="dark" checked={accepted} onChange={onAcceptChange} />

        <Button type="submit" variant="on-dark" fullWidth loading={sending} disabled={!accepted}>
          {SIGN_IN_COPY.submit}
        </Button>
      </form>

      {previewAvailable ? <SignInDevPreview onPreviewSent={onPreviewSent} /> : null}
    </div>
  );
}
