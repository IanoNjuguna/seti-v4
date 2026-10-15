'use client';

import { QrPlate } from '@/components/qr/QrPlate';
import { useRailIdentity } from '@/components/app/useRailIdentity';
import { RECEIVE_COPY } from './receive.constants';
import { ReceiveLinkPanel } from './ReceiveLinkPanel';

/**
 * The "your username" half: the code a sender scans, and the two strings they can
 * be handed instead.
 *
 * Get paid BY NAME — the half for another Seti ACCOUNT: they send to the name, and
 * the person never sees or shares an address at all. The address half is for a
 * transfer from outside Seti, and the merchant half for a customer paying a
 * business.
 *
 * The link and the code are the same string, and both come from `useRailIdentity`
 * — the same hook, and the same `merchant-link.ts`, that the rail's copy control
 * already uses. A second URL built here would be a second host and a second route
 * shape to keep in step.
 *
 * It renders NOTHING without a handle: the account's active mode may hold no name
 * yet, and the rail's identity card already offers the claim route for exactly that
 * state. Shown here, it would either duplicate that offer or — worse — show a code
 * for a link that resolves to nobody.
 *
 * It carries the OBJECTS only. The lead sentence above it belongs to the page
 * (`ReceivePage`), the same way every other page-level line does.
 */
export function ReceiveNameHalf() {
  const { signedIn, handle } = useRailIdentity();

  if (!signedIn || !handle) return null;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
      <QrPlate
        value={handle.link}
        title={RECEIVE_COPY.qrTitle(handle.handle)}
        download={{
          filename: RECEIVE_COPY.qrFilename(handle.handle),
          label: RECEIVE_COPY.download,
          working: RECEIVE_COPY.downloading,
          failed: RECEIVE_COPY.downloadFailed,
        }}
      />

      <ReceiveLinkPanel handle={handle.handle} link={handle.link} caption={handle.caption} />
    </div>
  );
}
