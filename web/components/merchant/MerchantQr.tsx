'use client';

import { Button, Text } from '@/components/ui';
import { handleLink, merchantHandle } from '@/lib/merchant-link';
import { claimCopy } from './Claim.constants';
import { QRCode } from './qr-code';
import { useQrDownload } from './useQrDownload';
import type { MerchantQrProps } from './ClaimForm.types';

const QR_DISPLAY_PX = 168;

/**
 * The printable QR of a handle's link — a business's sticker, or a person's code.
 *
 * The code encodes EXACTLY the link shown as text beside it (`handleLink`), so it is
 * a rendering of the link and not a second payload. `kind` decides which route that
 * is: a business's code opens `/m/<handle>` and a person's opens `/u/<handle>`, and
 * printing one for the other is how a customer ends up on the wrong page with an
 * address they can still pay. It carries no amount — the owner chose identity-only
 * for a printed sticker, so the customer enters what they are paying.
 */
export function MerchantQr({ name, kind }: MerchantQrProps) {
  const words = claimCopy(kind);
  const link = handleLink(kind, name);
  const { wrapper, download } = useQrDownload(`seti-${merchantHandle(name)}-qr.svg`);

  return (
    <div>
      <Text variant="micro" as="p">
        {words.qrLabel}
      </Text>

      <div ref={wrapper} className="mt-2 w-44 rounded-md bg-surface-soft p-3">
        <QRCode
          value={link}
          size={QR_DISPLAY_PX}
          level="M"
          fgColor="black"
          bgColor="white"
          title={link}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      <Text variant="micro" as="p" className="mt-2">
        {words.qrHint}
      </Text>

      <Button variant="secondary" onClick={download} fullWidth className="mt-3">
        {words.qrDownload}
      </Button>
    </div>
  );
}
