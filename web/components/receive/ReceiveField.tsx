'use client';

import { IconButton, Text } from '@/components/ui';
import { useCopyLink } from '@/components/app/useCopyLink';
import type { ReceiveFieldProps } from './ReceiveField.types';

/**
 * ONE string in a bordered field, with the control that copies it INSIDE the field.
 *
 * This is no longer part of `/app/receive`. The receive page presents its string as
 * display type with the copy control beside it (see `ReceiveHalf`), because the string
 * is the page's hero object rather than a value in a box; the field is what a screen
 * that genuinely holds a URL uses, and its remaining caller is the invite screen
 * (`components/invite/InviteLinkField.tsx`). It stays here because that is a real
 * caller, not because anything on this surface still draws it.
 *
 * The value is never truncated: `break-all` wraps a long link inside the field. A link
 * that is clipped mid-handle is the one thing on those screens that cannot be guessed
 * at, and it is the whole reason the field exists.
 *
 * The confirmation is a word rather than a glyph change alone, because the control is
 * an icon: `role="status"` announces it, and the sentence is the only thing telling a
 * pointer user that the press worked.
 */
export function ReceiveField({ label, value, copyLabel, copyFailed, copiedText }: ReceiveFieldProps) {
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

      <Text
        variant="micro"
        as="p"
        color="success"
        role="status"
        className={copied ? undefined : 'sr-only'}
      >
        {copied ? copiedText : ''}
      </Text>
    </div>
  );
}
