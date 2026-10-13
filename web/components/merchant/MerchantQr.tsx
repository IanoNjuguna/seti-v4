'use client';

import { useRef } from 'react';
import type { ComponentType, CSSProperties } from 'react';
import QRCodeBase from 'react-qr-code';
import { Button, Text } from '@/components/ui';
import { merchantHandle, merchantLink } from '@/lib/merchant-link';
import { CLAIM_COPY } from './Claim.constants';
import type { MerchantQrProps } from './ClaimForm.types';

/**
 * The props this component uses. Declared here rather than imported: react-qr-code's
 * shipped declaration resolves its `React` against a copy that is not present at
 * this level, so its `QRCodeProps` loses the SVG props and its class export fails
 * React 19's JSX check. The runtime export is a plain forwardRef component that
 * accepts exactly these, so this types the module at the boundary we use.
 */
interface MerchantQrCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  bgColor?: string;
  fgColor?: string;
  title?: string;
  style?: CSSProperties;
  className?: string;
}

/** Type-only cast of the default export; the runtime component is unchanged. */
const QRCode = QRCodeBase as unknown as ComponentType<MerchantQrCodeProps>;

/** The file's pixel size. The on-screen code is smaller; an SVG scales to any of it. */
const QR_PRINT_PX = 512;
const QR_DISPLAY_PX = 168;

/**
 * The printable QR of a merchant's link.
 *
 * The code encodes EXACTLY `merchantLink(name)` — the same call the result's link
 * text below uses — so it is a rendering of the link, not a second payload. It
 * carries no amount: the owner chose identity-only for a printed sticker, and the
 * customer enters what they are paying.
 *
 * The download serialises the rendered SVG (a Blob, no backend) at print size. A
 * clone is resized rather than the live node, so the on-screen size is untouched;
 * `xmlns` is added because a standalone SVG file needs it.
 */
export function MerchantQr({ name }: MerchantQrProps) {
  const wrapper = useRef<HTMLDivElement>(null);

  const download = () => {
    const svg = wrapper.current?.querySelector('svg');
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(QR_PRINT_PX));
    clone.setAttribute('height', String(QR_PRINT_PX));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `seti-${merchantHandle(name)}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Text variant="micro" as="p">
        {CLAIM_COPY.qrLabel}
      </Text>

      <div ref={wrapper} className="mt-2 w-44 rounded-md bg-surface-soft p-3">
        <QRCode
          value={merchantLink(name)}
          size={QR_DISPLAY_PX}
          level="M"
          fgColor="black"
          bgColor="white"
          title={merchantLink(name)}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      <Text variant="micro" as="p" className="mt-2">
        {CLAIM_COPY.qrHint}
      </Text>

      <Button variant="secondary" onClick={download} fullWidth className="mt-3">
        {CLAIM_COPY.qrDownload}
      </Button>
    </div>
  );
}
