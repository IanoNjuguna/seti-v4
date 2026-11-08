'use client';

import { Button, Text } from '@/components/ui';
import { QrPlate } from '@/components/qr/QrPlate';
import { useDownloadQr } from '@/components/qr/useDownloadQr';
import { handleLink, merchantHandle } from '@/lib/merchant-link';
import { claimCopy } from './Claim.constants';
import type { MerchantQrProps } from './ClaimForm.types';

/**
 * The printable QR of a handle's link: a business's sticker, or a person's code.
 *
 * The code encodes EXACTLY the link shown as text beside it (`handleLink`), so it is a rendering of
 * the link and not a second payload. `kind` decides which route that is: a business's code opens
 * `/m/<handle>` and a person's opens `/u/<handle>`, and printing one for the other is how a customer
 * ends up on the wrong page with an address they can still pay. It carries no amount, because the
 * owner chose identity-only for a printed sticker, so the customer enters what they are paying.
 *
 * It draws through `QrPlate` (#433). This was the last surface drawing its own code through
 * `react-qr-code` at level M with no mark, and the worst one to leave plain: a sticker is the
 * artifact a business prints, tapes to a till and photographs, and it was the only code in the
 * product that did not carry the mark.
 *
 * The save goes through the plate's own export (`useDownloadQr`), which serialises the registered
 * vector and writes a `QR_EXPORT_PX` PNG with the mark drawn from the same geometry that cleared the
 * well. The old control cloned whatever `<svg>` sat in the DOM and wrote a 512px SVG, so the two
 * surfaces shipped two sizes and two formats for one code.
 *
 * `11rem` rather than the plate's default 20rem: the sticker sits above a hint line and a button on
 * a claim screen that is already a column, and at level H a handle link is 33 modules plus the quiet
 * zone, which is 5.3px per module here. The print size does not come from this number: the export is
 * drawn at `QR_EXPORT_PX` from the vector.
 */
export function MerchantQr({ name, kind }: MerchantQrProps) {
  const words = claimCopy(kind);
  const link = handleLink(kind, name);
  const { state, download } = useDownloadQr(`seti-${merchantHandle(name)}-qr.png`, link);

  return (
    <div>
      <Text variant="micro" as="p">
        {words.qrLabel}
      </Text>

      <div className="mt-2 w-44">
        <QrPlate value={link} title={link} width="11rem" tone="light" />
      </div>

      <Text variant="micro" as="p" className="mt-2">
        {words.qrHint}
      </Text>

      <Button
        variant="secondary"
        onClick={() => void download()}
        loading={state === 'busy'}
        fullWidth
        className="mt-3"
      >
        {state === 'busy' ? words.qrDownloading : words.qrDownload}
      </Button>

      {state === 'failed' ? (
        <Text variant="micro" as="p" color="alert" className="mt-2">
          {words.qrDownloadFailed}
        </Text>
      ) : null}
    </div>
  );
}
