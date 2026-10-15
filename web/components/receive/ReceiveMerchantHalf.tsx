'use client';

import { QrPlate } from '@/components/qr/QrPlate';
import { RECEIVE_COPY } from './receive.constants';
import { handleLink, handleLinkLabel } from '@/lib/merchant-link';
import { ReceiveLinkPanel } from './ReceiveLinkPanel';

/**
 * The "your merchant name" half: the code a customer scans at a counter, and the
 * two strings a customer can be handed instead.
 *
 * It exists only once the account holds a business handle — the page decides that
 * and only offers the tab when it does — so this half never has to draw an empty
 * state.
 *
 * TWO strings, and they are not interchangeable: the HANDLE is the slug the link is
 * built from and the string a customer types (`javahouse`), while the NAME is how
 * the business is written to a reader (`Java House`). Passing the name into
 * `handleLink` produced `seti.live/m/Java House` — a link with a space in it, caught
 * in the render — so the code, the link and the copy controls all take the handle,
 * and only the code's accessible name takes the display name.
 */
export function ReceiveMerchantHalf({ name, handle }: { name: string; handle: string }) {
  const link = handleLink('business', handle);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
      <QrPlate
        value={link}
        title={RECEIVE_COPY.merchantQrTitle(name)}
        download={{
          filename: RECEIVE_COPY.qrFilename(handle),
          label: RECEIVE_COPY.download,
          working: RECEIVE_COPY.downloading,
          failed: RECEIVE_COPY.downloadFailed,
        }}
      />

      <ReceiveLinkPanel handle={handle} link={link} caption={handleLinkLabel('business', handle)} />
    </div>
  );
}
