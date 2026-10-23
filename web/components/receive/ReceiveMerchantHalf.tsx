'use client';

import { QrDownloadControl } from '@/components/qr/QrDownloadControl';
import { QrPlate } from '@/components/qr/QrPlate';
import { handleLink } from '@/lib/merchant-link';
import { RECEIVE_COPY } from './receive.constants';
import { ReceiveHalf } from './ReceiveHalf';
import type { ReceiveMerchantHalfProps } from './ReceiveMerchantHalf.types';

/**
 * The merchant half: the code a customer scans at the counter, and the name they are
 * paying.
 *
 * It exists only once the account holds a business handle, and the page decides that,
 * so this half never draws an empty state.
 *
 * The displayed name is the BUSINESS name (`Java House`) while the code and the saved
 * file take the HANDLE (`javahouse`). Passing the name into `handleLink` once produced
 * `seti.live/m/Java House`, so the split is stated here rather than left to each caller
 * to remember — and it is the reason this half offers no copy control: the string it
 * would write is not the string on screen, and a control that copies something other
 * than what it sits under is a worse answer than a code to print.
 *
 * The link row is gone, and with it the sentence that explained it. The code still
 * encodes the business link (`seti.live/m/<handle>`) so a customer's camera opens the
 * pay page: the payload is not the presentation.
 */
export function ReceiveMerchantHalf({ name, handle }: ReceiveMerchantHalfProps) {
  const link = handleLink('business', handle);
  const download = {
    filename: RECEIVE_COPY.qrFilename(handle),
    label: RECEIVE_COPY.download,
    working: RECEIVE_COPY.downloading,
    failed: RECEIVE_COPY.downloadFailed,
  };

  return (
    <ReceiveHalf
      plate={<QrPlate value={link} title={RECEIVE_COPY.merchantQrTitle(name)} />}
      headline={name}
      share={{ title: RECEIVE_COPY.merchantQrTitle(name), url: link }}
      download={<QrDownloadControl download={download} />}
    />
  );
}
