'use client';

import { CopyRow } from '@/components/copy/CopyRow';
import { RECEIVE_COPY } from './receive.constants';
import type { ReceiveLinkPanelProps } from './receive.types';

/**
 * The two things a sender can be handed, each with its own copy control: the NAME
 * to type, and the LINK to open.
 *
 * Two rows rather than one line of text with a single control, because they are
 * two different jobs: a person sharing a name wants the string a sender types, and
 * a person sharing a link wants the URL. The first version of this card copied
 * only the link, so the half a reader sees first could not leave the screen.
 *
 * The rows live in a `flex-col`, so they share a width and their controls line up
 * in a column even though the values are different lengths. `CopyRow` owns the
 * control, the state and the failure line; this component owns which two values an
 * account hands out.
 */
export function ReceiveLinkPanel({ handle, link, caption }: ReceiveLinkPanelProps) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <CopyRow
        display={`@${handle}`}
        value={handle}
        label={RECEIVE_COPY.copyHandle}
        failureText={RECEIVE_COPY.copyFailed}
        copiedText={RECEIVE_COPY.copiedAction}
        emphasis
      />

      <CopyRow
        display={caption}
        value={link}
        label={RECEIVE_COPY.copyLink}
        failureText={RECEIVE_COPY.copyFailed}
        copiedText={RECEIVE_COPY.copiedAction}
      />
    </div>
  );
}
