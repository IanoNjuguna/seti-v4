'use client';

import Link from 'next/link';
import { TERMS_URL } from '@/app/legal/site';
import {
  TERMS_BLOCKED_HINT,
  TERMS_CHECKBOX_HINT_ID,
  TERMS_CHECKBOX_ID,
  TERMS_LABEL_PREFIX,
  TERMS_LABEL_SUFFIX,
  TERMS_LINK_LABEL,
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
 * The label wraps the whole statement, including the link to the Terms, so the
 * checkbox's accessible name is the sentence the customer is agreeing to; the
 * link stays separately reachable by Tab. `text-mute` on a white canvas, and the
 * cobalt focus ring is the system's emphasis colour, as in `Input`.
 *
 * The hint is rendered only while unchecked and wired to the input by
 * `aria-describedby`, because a disabled button cannot say why it is disabled.
 */
export function TermsAcceptance({ checked, onChange }: TermsAcceptanceProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <input
          id={TERMS_CHECKBOX_ID}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={checked ? undefined : TERMS_CHECKBOX_HINT_ID}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light"
        />
        <label
          htmlFor={TERMS_CHECKBOX_ID}
          className="text-body-sm leading-relaxed text-mute"
        >
          {TERMS_LABEL_PREFIX}{' '}
          <Link
            href={TERMS_URL}
            className="font-semibold text-link underline underline-offset-4 transition-colors hover:text-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light"
          >
            {TERMS_LINK_LABEL}
          </Link>
          {TERMS_LABEL_SUFFIX}
        </label>
      </div>

      {checked ? null : (
        <p id={TERMS_CHECKBOX_HINT_ID} className="text-caption text-stone">
          {TERMS_BLOCKED_HINT}
        </p>
      )}
    </div>
  );
}
