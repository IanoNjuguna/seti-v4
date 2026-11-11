'use client';

import { Button, Input } from '@/components/ui';
import { TermsAcceptance } from '@/components/auth/TermsAcceptance';
import { SIGN_IN_COPY } from './SignInScreen.constants';
import { SignInDevPreview } from './SignInDevPreview';
import { SignInFailure } from './SignInFailure';
import type { SignInEntryFormProps } from './SignInScreen.types';

/**
 * The front door: the one instruction, the consent, one field and one button.
 *
 * ## The heading stepped down to the app's own size
 *
 * It was `display-md` (40px) stepping up from `heading-lg`, which is the landing page's
 * marketing scale — a 40px line inside a 384px column is a hero trying to fit a form.
 * The reference this page now follows sets its instruction near 30px with the supporting
 * line at 16, and that ratio is what makes an instruction read as an instruction rather
 * than as an advertisement. So the page uses `heading-lg` (32px) and `body-md` (16px):
 * both are system tokens, both are the tokens the reference's proportions land on, and
 * nothing new was invented for one screen.
 *
 * ## The consent sits above the form
 *
 * It used to sit between the field and the button, because the gate belongs on the
 * control that acts. With one door it could live either side of the field and mean the
 * same thing; it stays above because the sentence is then read before the field is
 * filled, not after, and the control it gates is still the last thing on the page.
 *
 * The button is not disabled for an empty address: only the consent gates it, and the
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
  onAddressChange,
  onAcceptChange,
  onSubmit,
  onPreviewSent,
}: SignInEntryFormProps) {
  return (
    <div className="flex flex-col">
      {/*
        * `text-balance`: this instruction wraps, and at the heading size it wrapped as
        * "Sign in with your / email.", a six-glyph last line — a rag that reads as a
        * mistake on the page's only heading. Balancing gives two near-equal lines with
        * the copy, the size and the column untouched.
        *
        * The fallback is the current behaviour, not a broken one: an engine without
        * `text-wrap: balance` ignores the declaration and wraps exactly as it does
        * today, which is why this is safe on the front door.
        */}
      {/* One heading at the size the code screen's heading will be, so the two steps of
          the flow do not change scale when the page changes job. */}
      <h1 className="text-balance font-brand text-heading-lg font-medium text-on-dark">
        {SIGN_IN_COPY.title}
      </h1>
      <p className="mt-3 text-body-md text-on-dark-mute">{SIGN_IN_COPY.lede}</p>

      {/* Above the controls, so the reason and the thing to press are adjacent. */}
      {error ? (
        <div className="mt-6">
          <SignInFailure error={error} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-5">
        <TermsAcceptance tone="dark" checked={accepted} onChange={onAcceptChange} />

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {/* No `autoFocus`. The page's one instruction is the heading above, and focusing
              this field drags the viewport to it: at 780x489 the heading scrolls out of
              sight and the page appears to start mid-sentence. On a phone it also opens
              the keyboard over the consent and the door, which are the first decision.
              The field focuses on tap like every other input. */}
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
