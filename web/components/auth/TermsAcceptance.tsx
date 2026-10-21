'use client';

import Link from 'next/link';
import { TERMS_URL } from '@/app/legal/site';
import { cn } from '@/lib/cn';
import {
  TERMS_BLOCKED_HINT,
  TERMS_CHECKBOX_HINT_ID,
  TERMS_CHECKBOX_ID,
  TERMS_LABEL_PREFIX,
  TERMS_LABEL_SUFFIX,
  TERMS_LINK_LABEL,
  TERMS_SENTENCE_ID,
  TERMS_TONE_CLASSES,
} from './TermsAcceptance.constants';
import type { TermsAcceptanceProps } from './TermsAcceptance.types';

/**
 * The sign-up terms checkbox.
 *
 * A real `<input type="checkbox">`, so it is keyboard-operable, announces its
 * state, and is toggled by Space with no key handling of our own. It is
 * controlled by the caller, which disables sign-in until it is ticked — the
 * gate lives on the control that acts, not only in a click handler.
 *
 * The sentence is split into two `<label htmlFor>` runs either side of the link
 * to `/terms`, and the input is named by the sentence's own element through
 * `aria-labelledby`. One label wrapping the whole statement reads better in the
 * source, but a link inside a label is interactive content in a label: Chrome
 * then neither follows the link nor activates the control, so the consent linked
 * to a document that silently would not open. Two labels plus
 * `aria-labelledby` keep both: either text run ticks the box, the link navigates,
 * and the announced name is still the whole sentence, `Terms of Use` included.
 * `text-mute` on a white canvas, and the cobalt focus ring is the system's
 * emphasis colour, as in `Input`.
 *
 * The hint is rendered only while unchecked and wired to the input by
 * `aria-describedby`, because a disabled button cannot say why it is disabled.
 *
 * `tone` is the one thing that varies by surface, and it is the SAME control on
 * both: the front door (`/signin`) renders this instance rather than a second
 * consent statement of its own, so the sentence the customer agreed to cannot read
 * differently in the two places it is asked.
 */
export function TermsAcceptance({ checked, onChange, tone = 'light' }: TermsAcceptanceProps) {
  const classes = TERMS_TONE_CLASSES[tone];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <input
          id={TERMS_CHECKBOX_ID}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-labelledby={TERMS_SENTENCE_ID}
          aria-describedby={checked ? undefined : TERMS_CHECKBOX_HINT_ID}
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            classes.focusRing,
            // The box a native checkbox paints follows the page's colour scheme, not
            // the colour behind it. On `canvas-dark` the document is `normal`, so the
            // control rendered as a solid white 16px block: it read as a placeholder,
            // not as something to tick. `color-scheme: dark` on the control alone paints
            // it as a dark box with a visible edge, without hiding the native input,
            // without a redrawn box, and without losing the keyboard and screen-reader
            // behaviour the comment above is careful about.
            classes.control
          )}
        />
        <p
          id={TERMS_SENTENCE_ID}
          className={cn('text-body-sm leading-relaxed', classes.label)}
        >
          <label htmlFor={TERMS_CHECKBOX_ID}>{TERMS_LABEL_PREFIX}</label>{' '}
          <Link href={TERMS_URL} className={classes.link}>
            {TERMS_LINK_LABEL}
          </Link>
          <label htmlFor={TERMS_CHECKBOX_ID}>{TERMS_LABEL_SUFFIX}</label>
        </p>
      </div>

      {checked ? null : (
        <p id={TERMS_CHECKBOX_HINT_ID} className={classes.hint}>
          {TERMS_BLOCKED_HINT}
        </p>
      )}
    </div>
  );
}
