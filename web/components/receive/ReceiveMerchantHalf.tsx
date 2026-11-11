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
 * THE ROW PRINTS BOTH, and the control copies the handle (#549). This half used to offer
 * no copy at all: the string on screen was the name and every string it hands out was
 * built from the handle, so a control under `Java House` would have written something the
 * reader could not see. The row now reads `Merchant name: Java House @javahouse`, which
 * is the two facts the business actually holds — and the glyph sits after the handle it
 * writes, so the page never copies a string it has not printed. The two halves therefore
 * share one shape: a label, the string, the bare glyph.
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
        value: name,
        handle,
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
