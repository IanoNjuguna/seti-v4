'use client';

import { QrPlate } from '@/components/qr/QrPlate';
import { QrDownloadControl } from '@/components/qr/QrDownloadControl';
import { RECEIVE_COPY } from './receive.constants';
import { handleLink } from '@/lib/merchant-link';
import { ReceiveField } from './ReceiveField';
import { ReceiveHalf } from './ReceiveHalf';

/**
 * The "your business name" half: the code a customer scans at a counter, the name
 * they are paying, and the link behind the code.
 *
 * It exists only once the account holds a business handle, and the page decides
 * that, so this half never draws an empty state.
 *
 * The displayed name is the BUSINESS name (`Java House`) while the code, the link
 * and the note all take the HANDLE (`javahouse`). Passing the name into `handleLink`
 * once produced `seti.live/m/Java House`, so the split is stated here rather than
 * left to each caller to remember.
 */
export function ReceiveMerchantHalf({ name, handle }: { name: string; handle: string }) {
  const link = handleLink('business', handle);

  return (
    <ReceiveHalf
      plate={
        <QrPlate
          value={link}
          title={RECEIVE_COPY.merchantQrTitle(name)}
          align="start"
        />
      }
      title={name}
      field={
        <ReceiveField
          label={RECEIVE_COPY.linkLabel}
          value={link}
          copyLabel={RECEIVE_COPY.copyLink}
          copyFailed={RECEIVE_COPY.copyFailed}
          copiedText={RECEIVE_COPY.copiedAction}
          note={RECEIVE_COPY.merchantNote(handle)}
        />
      }
      share={{ title: RECEIVE_COPY.merchantQrTitle(name), url: link }}
      download={
        <QrDownloadControl
          download={{
            filename: RECEIVE_COPY.qrFilename(handle),
            label: RECEIVE_COPY.download,
            working: RECEIVE_COPY.downloading,
            failed: RECEIVE_COPY.downloadFailed,
          }}
        />
      }
    />
  );
}
