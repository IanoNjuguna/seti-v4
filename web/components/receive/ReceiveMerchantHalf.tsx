'use client';

import { QrDownloadControl } from '@/components/qr/QrDownloadControl';
import { ReceiveAskLink } from './ReceiveAskLink';
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
 * to remember.
 *
 * THE ROW PRINTS THE HANDLE (#549), not the business name. The owner's call, and it is
 * the consistent one: both halves print the string a person actually pays, and the glyph
 * after it copies what it sits under. `Java House` has not gone anywhere — it is still
 * the code's own accessible name (`seti.live/m/<handle> at your counter`) and the share
 * sheet's title, which is where a customer reads it after scanning. What left is a row
 * that printed a name no copy control could honestly act on.
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
      name={{
        label: RECEIVE_COPY.merchantNameLabel,
        value: `@${handle}`,
        copy: {
          value: handle,
          label: RECEIVE_COPY.merchantCopyLabel,
          confirmed: RECEIVE_COPY.merchantCopyConfirmed,
          failed: RECEIVE_COPY.merchantCopyFailed,
        },
      }}
      share={{ title: RECEIVE_COPY.merchantQrTitle(name), url: link }}
      download={<QrDownloadControl download={download} />}
      claim={<ReceiveAskLink />}
    />
  );
}
