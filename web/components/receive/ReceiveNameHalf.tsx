'use client';

import { QrDownloadControl } from '@/components/qr/QrDownloadControl';
import { QrPlate } from '@/components/qr/QrPlate';
import { RECEIVE_COPY } from './receive.constants';
import { ReceiveHalf } from './ReceiveHalf';
import type { ReceiveNameHalfProps } from './ReceiveNameHalf.types';

/**
 * The username half: the code a sender scans, and the one string it stands for.
 *
 * Get paid from another Seti ACCOUNT. This is the half every account has, and for a
 * person it is the whole page — there is no switch above a single view.
 *
 * ONE string leaves this half now, and it is the username. It used to offer two copy
 * rows, the bare name and the absolute link, which gave the same weight to two
 * different jobs and turned the half into a form; then it showed the link alone with a
 * sentence explaining that a name would also do. The owner's instruction settles it:
 * the username is what the page presents, and the link is only the shareable form of
 * it. The link therefore leaves in exactly two ways that a person can see no string
 * for: the code's payload, and the share sheet.
 *
 * The code still encodes the resolvable link (`seti.live/u/<handle>`) rather than the
 * bare name, deliberately: a phone camera that reads it has to be able to open
 * something. The PAYLOAD is not the PRESENTATION. `components/qr/**` is untouched by
 * this change and takes only `value` and `title`.
 *
 * The handle and the link come from `useRailIdentity`, the same hook and the same
 * `merchant-link.ts` the rail's identity card uses: a second URL built here would be a
 * second host and a second route shape to keep in step. The page decides whether this
 * half is drawn at all — it renders nothing without a handle, and a code for a link
 * that resolves to nobody would be worse than no code.
 */
export function ReceiveNameHalf({ handle, link }: ReceiveNameHalfProps) {
  const download = {
    filename: RECEIVE_COPY.qrFilename(handle),
    label: RECEIVE_COPY.download,
    working: RECEIVE_COPY.downloading,
    failed: RECEIVE_COPY.downloadFailed,
  };

  return (
    <ReceiveHalf
      plate={<QrPlate value={link} title={RECEIVE_COPY.qrTitle(handle)} />}
      headline={`@${handle}`}
      copy={{
        value: handle,
        label: RECEIVE_COPY.copyLabel,
        confirmed: RECEIVE_COPY.copyConfirmed,
      }}
      share={{ title: RECEIVE_COPY.qrTitle(handle), url: link }}
      download={<QrDownloadControl download={download} />}
    />
  );
}
