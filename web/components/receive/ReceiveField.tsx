'use client';

import { IconButton, Text } from '@/components/ui';
import { useCopyLink } from '@/components/app/useCopyLink';
import type { ReceiveFieldProps } from './ReceiveField.types';

/**
 * The ONE string a receive half hands out, in a bordered field, with the control
 * that copies it INSIDE the field.
 *
 * The field is the whole point of the layout change. Before it, a half was a
 * plate beside a stack of two or three unbordered lines, so the code, the name and
 * the link all had the same weight and the reader had to work out which string was
 * the one to hand over. Here the border draws the boundary of the value, and the
 * control sits at the end of the line it copies rather than in a column of its own.
 *
 * The value is never truncated: `break-all` wraps a 42-character address inside the
 * field. An address that is clipped is the one thing on this screen that cannot be
 * guessed at, and a QR fails exactly when the camera will not focus.
 *
 * The confirmation is a word rather than a glyph change alone, because the control
 * is an icon: `role="status"` announces it, and the sentence is the only thing
 * telling a pointer user that the press worked.
 */
export function ReceiveField({
  label,
  value,
  copyLabel,
  copyFailed,
  copiedText,
  note,
}: ReceiveFieldProps) {
  const { state, copy } = useCopyLink(value);
  const copied = state === 'copied';

  return (
    <div className="flex w-full flex-col gap-2">
      <Text variant="micro" as="p" color="secondary">
        {label}
      </Text>

      <div className="flex w-full items-start gap-3 rounded-md bg-surface-soft px-4 py-3">
        <p className="min-w-0 flex-1 break-all font-mono text-body-sm text-ink">{value}</p>
        <IconButton
          name={copied ? 'check' : 'copy'}
          tone={copied ? 'confirmed' : 'default'}
          label={copyLabel}
          onClick={copy}
          className="shrink-0"
        />
      </div>

      {state === 'failed' ? (
        <Text variant="micro" as="p" color="alert">
          {copyFailed}
        </Text>
      ) : null}

      <Text variant="micro" as="p" color="success" role="status" className={copied ? undefined : 'sr-only'}>
        {copied ? copiedText : ''}
      </Text>

      {note ? (
        <Text variant="micro" as="p" color="secondary">
          {note}
        </Text>
      ) : null}
    </div>
  );
}
