'use client';

import { Button, Input } from '@/components/ui';
import { TermsAcceptance } from '@/components/auth/TermsAcceptance';
import { cn } from '@/lib/cn';
import { SIGN_IN_COPY } from './SignInScreen.constants';
import { SIGN_IN_BLOCK_STEP } from './SignInPanel.constants';
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
 * ## `text-balance` on the h1, because the column is 384px wide
 *
 * At `display-md` the instruction is wider than the column, so it takes two lines —
 * and by default it took them as `Sign in with your / email.`, a six-glyph last line
 * that looks like a widow and makes the headline read as broken. Balancing the wrap
 * gives two lines of near-equal measure (`Sign in with / your email.`) without
 * touching the copy, the size or the column. Same at 390, where `heading-lg` is the
 * size and the same break appears.
 *
 * ## ONE block step, 24px
 *
 * Every seam on the page is `SIGN_IN_BLOCK_STEP`: mark → headline → lede → form, and
 * the form's own controls. Five different gaps (32/20/24/20/8) were what made a single
 * column read as a stack of unrelated rows.
 *
 * The consent is the app's own `TermsAcceptance` control in its `dark` tone, not a
 * second statement written for this page: sign-in here creates the account, so the
 * terms are accepted BEFORE the request that can create one, and the sentence the
 * customer agrees to exists in exactly one place. It sits between the field and the
 * button because the gate belongs on the control that acts — `Button` is genuinely
 * `disabled` until it is ticked, and the control's own hint says why while it is not.
 *
 * ## The blocked button is an OUTLINE, not a grey slab
 *
 * The CTA is white when it can be pressed. While the consent is missing it used to be
 * that same white at `opacity-60`, i.e. a solid `#999999` block with a 3.8:1 label —
 * the largest solid mass on a page of black, pointing at the one control that does
 * nothing, and reading as an enabled button that is broken. Blocked, it now wears the
 * system's `outline-dark` secondary: no fill, a 1px `on-dark` edge, so the page's
 * weight sits with the headline and the field, and ticking the box FILLS the button —
 * the consent's consequence is visible at the moment it happens. The gate itself is
 * unchanged (`disabled` plus the `!accepted` guard in `useSignInScreen`).
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
      <h1 className="text-balance font-brand text-heading-lg font-medium text-on-dark sm:text-display-md">
        {SIGN_IN_COPY.title}
      </h1>
      <p className={cn(SIGN_IN_BLOCK_STEP, 'text-body-lg text-on-dark-mute')}>{SIGN_IN_COPY.lede}</p>

      {/* Above the button, so the reason and the thing to press are adjacent. */}
      {error ? (
        <div className={SIGN_IN_BLOCK_STEP}>
          <SignInFailure message={error} />
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        noValidate
        className={cn(SIGN_IN_BLOCK_STEP, 'flex flex-col gap-6')}
      >
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

        <Button
          type="submit"
          variant={accepted ? 'on-dark' : 'outline-dark'}
          fullWidth
          loading={sending}
          disabled={!accepted}
        >
          {SIGN_IN_COPY.submit}
        </Button>
      </form>

      {previewAvailable ? <SignInDevPreview onPreviewSent={onPreviewSent} /> : null}
    </div>
  );
}
