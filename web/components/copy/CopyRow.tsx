'use client';

import { IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCopyLink } from '@/components/app/useCopyLink';
import { VALUE_CLASSES } from './CopyRow.constants';
import type { CopyRowProps } from './CopyRow.types';

/**
 * One value and the control that copies it — the control IMMEDIATELY after the
 * value, on the value's own line, with a small gap.
 *
 * It used to be pinned to the row's far edge (`justify-between`), which on a wide
 * row put it in a column of its own: the icon read as the row's control rather
 * than as part of the value it copies, and on a wide screen it sat an entire
 * screen-width away from a three-character username. It now travels WITH the
 * value, so however short or long the value is, the icon is the next thing after
 * it. That is the whole point of the row: the string and the way to take it are
 * one object, and nothing else may come between them.
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
  const valueClasses = cn('font-mono', VALUE_CLASSES[emphasis ? 'loud' : 'quiet'][surface]);

  const control = (
    <IconButton
      name={copied ? 'check' : 'copy'}
      tone={copied ? 'confirmed' : 'default'}
      surface={surface}
      label={label}
      onClick={copy}
      className={wrap ? 'align-middle' : undefined}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {wrap ? (
        /* ONE text flow, so a value too long for the line carries its control on
           the line its last character is on. The space is the break opportunity:
           the control steps down to the next line rather than being pushed off
           the edge, and the value is never clipped to make room for it. */
        <p className={cn('min-w-0 break-all', valueClasses)}>
          {display} {control}
        </p>
      ) : (
        /* A value that never exceeds one line: the text truncates, and the
           control follows at whatever width is left on that line. */
        <p className={cn('flex min-w-0 items-center gap-1.5', valueClasses)}>
          <span className="min-w-0 truncate">{display}</span>
          {control}
        </p>
      )}

      {/* No on-screen label on the control, so the confirmation is announced
          rather than shown: an icon changing shape is not something a screen
          reader can report. The control's own name stays what it DOES, so it is
          still "Copy username" the next time it is reached. */}
      <span aria-live="polite" className="sr-only">
        {copied ? copiedText : ''}
      </span>

      {state === 'failed' ? (
        <p className={cn('text-body-sm', surface === 'dark' ? 'text-on-dark-mute' : 'text-mute')}>
          {failureText}
        </p>
      ) : null}
    </div>
  );
}
