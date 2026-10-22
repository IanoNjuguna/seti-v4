'use client';

import { QrPlate } from '@/components/qr/QrPlate';
import { useRailIdentity } from '@/components/app/useRailIdentity';
import { QrDownloadControl } from '@/components/qr/QrDownloadControl';
import { RECEIVE_COPY } from './receive.constants';
import { ReceiveField } from './ReceiveField';
import { ReceiveHalf } from './ReceiveHalf';

/**
 * The "your username" half: the code a sender scans, the name it stands for, and the
 * link a sender can be handed instead.
 *
 * Get paid BY NAME: this is the half for another Seti ACCOUNT. The address half is
 * for a transfer from outside Seti, and the merchant half for a customer paying a
 * business.
 *
 * ONE string leaves this half. It used to offer two copy rows, the bare name and the
 * link, which gave the same weight to two different jobs and turned the half into a
 * form. The link is the string that travels (it is what the code encodes and what a
 * chat pastes), and the name is still handed over in words: the note under the field
 * says a Seti account can simply type it.
 *
 * The link and the code are the same string and both come from `useRailIdentity`, the
 * same hook and the same `merchant-link.ts` the rail's copy control uses. A second
 * URL built here would be a second host and a second route shape to keep in step.
 *
 * It renders NOTHING without a handle: the account's active mode may hold no name
 * yet, and the rail's identity card already offers the claim route for that state.
 * A code for a link that resolves to nobody would be worse than no code.
 */
export function ReceiveNameHalf() {
  const { signedIn, handle } = useRailIdentity();

  if (!signedIn || !handle) return null;

  return (
    <ReceiveHalf
      plate={
        <QrPlate
          value={handle.link}
          title={RECEIVE_COPY.qrTitle(handle.handle)}
          align="start"
        />
      }
      title={`@${handle.handle}`}
      monoTitle
      field={
        <ReceiveField
          label={RECEIVE_COPY.linkLabel}
          value={handle.link}
          copyLabel={RECEIVE_COPY.copyLink}
          copyFailed={RECEIVE_COPY.copyFailed}
          copiedText={RECEIVE_COPY.copiedAction}
          note={RECEIVE_COPY.nameNote(handle.handle)}
        />
      }
      share={{ title: RECEIVE_COPY.qrTitle(handle.handle), url: handle.link }}
      download={
        <QrDownloadControl
          download={{
            filename: RECEIVE_COPY.qrFilename(handle.handle),
            label: RECEIVE_COPY.download,
            working: RECEIVE_COPY.downloading,
            failed: RECEIVE_COPY.downloadFailed,
          }}
        />
      }
    />
  );
}
