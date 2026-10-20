'use client';

import { Button, Input } from '@/components/ui';
import { TermsAcceptance } from '@/components/auth/TermsAcceptance';
import { SIGN_IN_COPY } from './SignInScreen.constants';
import { SignInDevPreview } from './SignInDevPreview';
import { SignInFailure } from './SignInFailure';
import { SignInGoogleDoor } from './SignInGoogleDoor';
import type { SignInEntryFormProps } from './SignInScreen.types';

/**
 * The front door: the one instruction, one field, the consent, one button — plus, on a
 * Privy build, the Google shortcut above the field.
 *
 * The type is the landing page's own — `font-brand` at `heading-lg` stepping to
 * `display-md` with the lede at `body-lg` in `on-dark-mute`, exactly the hero's pair.
 * The display line is raw markup rather than `Text` because the system's display sizes
 * have no `Text` variant; `HeroCopy` and `ClosingSection` do the same.
 *
 * ## The consent moved ABOVE both doors
 *
 * It used to sit between the field and the button, because the gate belongs on the
 * control that acts. There are two controls that act now, and either of them can create
 * the account, so the gate belongs on both — which means above both. Each is disabled
 * until it is ticked, and the control's own hint says why while it is not.
 *
 * Neither button is disabled for an empty address: only the consent gates them, and the
 * session already answers a missing address with a plain sentence in the failure block
 * directly above. `noValidate` keeps the browser's bubble out of it, so the reason a
 * press did not work is always Seti's sentence in Seti's language.
 */
export function SignInEntryForm({
  address,
  error,
  sending,
  accepted,
  previewAvailable,
  googleAvailable,
  onAddressChange,
  onAcceptChange,
  onSubmit,
  onGoogle,
  onPreviewSent,
}: SignInEntryFormProps) {
  return (
    <div className="flex flex-col">
      {/*
        * `text-balance`: at 40px in a 384px column this instruction wrapped as
        * "Sign in with your / email.", a six-glyph last line — a rag that reads as a
        * mistake on the page's only heading. Balancing gives two near-equal lines with
        * the copy, the size and the column untouched.
        *
        * The fallback is the current behaviour, not a broken one: an engine without
        * `text-wrap: balance` ignores the declaration and wraps exactly as it does
        * today, which is why this is safe on the front door.
        */}
      <h1 className="text-balance font-brand text-heading-lg font-medium text-on-dark sm:text-display-md">
        {SIGN_IN_COPY.title}
      </h1>
      <p className="mt-5 text-body-lg text-on-dark-mute">{SIGN_IN_COPY.lede}</p>

      {/* Above the controls, so the reason and the thing to press are adjacent. */}
      {error ? (
        <div className="mt-6">
          <SignInFailure message={error} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-5">
        <TermsAcceptance tone="dark" checked={accepted} onChange={onAcceptChange} />

        {googleAvailable ? <SignInGoogleDoor disabled={!accepted} onGoogle={onGoogle} /> : null}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {/* No `autoFocus`. The page's one instruction is the heading above, and focusing
              this field drags the viewport to it: at 780x489 the heading scrolls out of
              sight and the page appears to start mid-sentence. On a phone it also opens
              the keyboard over the consent and the two doors, which are the first
              decision. The field focuses on tap like every other input. */}
          <Input
            label={SIGN_IN_COPY.emailLabel}
            tone="dark"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={address}
            onChange={(event) => onAddressChange(event.target.value)}
          />

          <Button type="submit" variant="on-dark" fullWidth loading={sending} disabled={!accepted}>
            {SIGN_IN_COPY.submit}
          </Button>
        </form>
      </div>

      {previewAvailable ? <SignInDevPreview onPreviewSent={onPreviewSent} /> : null}
    </div>
  );
}
