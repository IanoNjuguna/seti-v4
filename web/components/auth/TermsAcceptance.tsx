'use client';

import Link from 'next/link';
import { TERMS_URL } from '@/app/legal/site';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import {
  TERMS_BLOCKED_HINT,
  TERMS_BOX_INDENT,
  TERMS_CHECKBOX_HINT_ID,
  TERMS_CHECKBOX_ID,
  TERMS_CHECKBOX_SIZE,
  TERMS_LABEL_PREFIX,
  TERMS_LABEL_SUFFIX,
  TERMS_LINK_LABEL,
  TERMS_TONE_CLASSES,
} from './TermsAcceptance.constants';
import type { TermsAcceptanceProps } from './TermsAcceptance.types';

/**
 * The sign-up terms checkbox.
 *
 * ## The box is DRAWN, and the input is still a real checkbox
 *
 * It was `appearance: auto` at 16px, and a native empty checkbox on a black canvas
 * renders as a solid light square: an unticked control that reads as already ticked,
 * i.e. the one state this control must never look like. So the input keeps being the
 * input — `appearance-none`, the same element, keyboard-operable, announced, toggled by
 * Space and by the label's click — and only its PAINT is ours: a 1px hairline box on
 * the surface's own ink, a cobalt fill when checked (what `accent-color` was drawing
 * anyway), and a drawn tick on top. Colour is never the only signal: the tick is a
 * glyph, not a shade change.
 *
 * ## The hint sits on the STATEMENT's edge, not the column's
 *
 * It was full-width in the block, so it started at the column's left edge while the
 * sentence it explains started 28px in: a line of text hanging off the wrong axis,
 * which is exactly the kind of edge a reader feels without being able to name. It is
 * now indented by the box and its gap (`TERMS_BOX_INDENT`), so the explanation begins
 * where the thing it explains begins.
 *
 * The label wraps the whole statement, including the link to the Terms, so the
 * checkbox's accessible name is the sentence the customer is agreeing to; the link
 * stays separately reachable by Tab. `text-mute` on a white canvas, and the cobalt
 * focus ring is the system's emphasis colour, as in `Input`.
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
        <span className={cn('relative block shrink-0', TERMS_CHECKBOX_SIZE)}>
          <input
            id={TERMS_CHECKBOX_ID}
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            aria-describedby={checked ? undefined : TERMS_CHECKBOX_HINT_ID}
            className={cn(
              'h-full w-full cursor-pointer appearance-none rounded-sm border bg-transparent transition-colors',
              'checked:border-primary checked:bg-primary',
              classes.box,
              classes.focusRing,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
            )}
          />
          {checked ? (
            <Icon
              name="check"
              className={cn('pointer-events-none absolute inset-0 h-full w-full', classes.tick)}
            />
          ) : null}
        </span>
        <label
          htmlFor={TERMS_CHECKBOX_ID}
          className={cn('text-body-sm leading-relaxed', classes.label)}
        >
          {TERMS_LABEL_PREFIX}{' '}
          <Link href={TERMS_URL} className={classes.link}>
            {TERMS_LINK_LABEL}
          </Link>
          {TERMS_LABEL_SUFFIX}
        </label>
      </div>

      {checked ? null : (
        <p id={TERMS_CHECKBOX_HINT_ID} className={cn(classes.hint, TERMS_BOX_INDENT)}>
          {TERMS_BLOCKED_HINT}
        </p>
      )}
    </div>
  );
}
