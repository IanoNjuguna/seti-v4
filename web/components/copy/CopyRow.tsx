'use client';

import { IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCopyLink } from '@/components/app/useCopyLink';
import type { CopyRowProps } from './CopyRow.types';

/**
 * One value and the control that copies it, on ONE line.
 *
 * The control is a small round icon that becomes a green check, not a button with
 * the word "Copy" in it: the row already says what is being copied, and a labelled
 * button beside a labelled value is the same fact twice — which is what made the
 * first version of the receive card read as a form.
 *
 * A row per value, each with its OWN control, because a person may need either
 * half: a sender types the name, or opens the link. One shared control underneath
 * made that choice for them, wrongly.
 *
 * Rows in a column share a width, so the controls line up even though the values
 * are different lengths — ragged controls are what makes a stack read as
 * unrelated fragments rather than as a block.
 *
 * The failure line is rendered rather than swallowed: a copy the browser blocked
 * is exactly the case where the person has to select the text by hand, and
 * pretending it worked leaves them pasting whatever was on the clipboard before.
 * That is also why the value stays VISIBLE and is never merely behind the button.
 */
export function CopyRow({
  display,
  value,
  label,
  failureText,
  copiedText,
  surface = 'light',
  emphasis = false,
  wrap = false,
}: CopyRowProps) {
  const { state, copy } = useCopyLink(value);
  const copied = state === 'copied';

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <span
          className={cn(
            'min-w-0 font-mono',
            wrap ? 'break-all' : 'truncate',
            emphasis
              ? 'text-body-md-bold'
              : 'text-body-sm',
            surface === 'dark'
              ? emphasis
                ? 'text-on-dark'
                : 'text-on-dark-mute'
              : emphasis
                ? 'text-ink'
                : 'text-mute'
          )}
        >
          {display}
        </span>

        <IconButton
          name={copied ? 'check' : 'copy'}
          tone={copied ? 'confirmed' : 'default'}
          surface={surface}
          label={label}
          onClick={copy}
          className="shrink-0"
        />
      </div>

      {/* No on-screen label on the control, so the confirmation is announced
          rather than shown: an icon changing shape is not something a screen
          reader can report. The control's own name stays what it DOES, so it is
          still "Copy username" the next time it is reached. */}
      <span aria-live="polite" className="sr-only">
        {copied ? copiedText : ''}
      </span>

      {state === 'failed' ? (
        <p
          className={cn(
            'text-body-sm',
            surface === 'dark' ? 'text-on-dark-mute' : 'text-mute'
          )}
        >
          {failureText}
        </p>
      ) : null}
    </div>
  );
}
