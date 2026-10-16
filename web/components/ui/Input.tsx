'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';
import { Text } from './Text';
import type { InputProps } from './Input.types';

/**
 * A labelled text field in the web app's own token vocabulary.
 *
 * The spec's `text-input`: 56px tall and `rounded-md` (12px), `surface-soft` as
 * the well, and the cobalt `primary` token as the focus border — the system has
 * no dedicated focus token, and cobalt is its emphasis colour. The error state
 * swaps the border to `accent-danger` AND renders the message, because colour
 * alone must never be the only signal (design-enforcement).
 *
 * `label` and `error` are both wired to the input by id/aria so a screen reader
 * announces them; the label is visible rather than a placeholder, since a
 * placeholder disappears as soon as the field is filled.
 *
 * Two tones, one contract. `tone="dark"` is for a field on the dark canvas and only
 * swaps which tokens are used — the id/aria wiring, the visible label and the "colour
 * is never the only signal" rule are shared, so a field on either surface behaves
 * identically to a screen reader. Its fill is `surface-elevated`, the doc's one
 * permitted second dark step off `canvas-dark`: a `canvas-dark` fill is invisible on
 * the black canvas the sign-in page is drawn on (the field read as a 12% hairline and
 * nothing else), and `surface-elevated` is the same inset the page's own failure block
 * uses (`SignInFailure`).
 *
 * The message and hint are `Text` like everything else: colour comes from the
 * `color` role (`alert` for the error, the `micro` default for the light hint,
 * `inverse-muted` for the dark one). They used to be raw elements naming a token
 * class by hand because a variant's baked colour beat the `color` prop — that is
 * fixed in `Text`, so the workaround is gone.
 *
 * The light tone's two faint inks are the field's NAME and its PLACEHOLDER, and
 * both were `stone` (#8d969e): 3.0:1 on the label's white band and 2.7:1 on the
 * well it sits in, so the label of every field and the hint inside it were below
 * AA. The label steps to `mute` (#505a63, 7.0:1) because a field's name is
 * supporting text, and the placeholder to `ash` (#5c5e60, 5.9:1 on
 * `surface-soft`) because the hint inside a field must stay lighter than what is
 * typed into it. `ink` is 16.4:1 there, so the two cannot be confused. `stone`
 * is left for rules and disabled foreground.
 */
export function Input({ label, hint, error, tone = 'light', className, id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const dark = tone === 'dark';

  return (
    <div className="w-full">
      {/*
        ONE label element. Rendering `Text as="label"` inside a <label> produced a
        nested label, which is invalid HTML and gives the field two competing
        accessible names — invisible to typecheck and lint, obvious in the DOM.
        The label keeps a single colour class of its own, so it is not a victim of
        the override trap.
      */}
      <label htmlFor={inputId} className={cn('text-body-sm', dark ? 'text-on-dark-mute' : 'text-mute')}>
        {label}
      </label>

      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        className={cn(
          'mt-2 h-14 w-full rounded-md border px-4 text-body-md outline-none transition-colors',
          dark
            ? 'bg-surface-elevated text-on-dark placeholder:text-on-dark-mute'
            : 'bg-surface-soft text-ink placeholder:text-ash',
          'focus:border-primary focus:ring-1 focus:ring-primary',
          error ? 'border-accent-danger' : dark ? 'border-hairline-dark' : 'border-hairline-light',
          props.disabled && 'cursor-not-allowed opacity-60',
          className
        )}
      />

      {/* The colour is never the only signal: the border carries the same state, and
          the message is a sentence that names the cause. */}
      {error ? (
        <Text id={errorId} variant="micro" color="alert" as="p" className="mt-1">
          {error}
        </Text>
      ) : hint ? (
        <Text
          id={hintId}
          variant="micro"
          color={dark ? 'inverse-muted' : undefined}
          as="p"
          className="mt-1"
        >
          {hint}
        </Text>
      ) : null}
    </div>
  );
}
