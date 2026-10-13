'use client';

import type { ComponentType, CSSProperties } from 'react';
import QRCodeBase from 'react-qr-code';
import { RECEIPT_QR_BACKGROUND, RECEIPT_QR_FOREGROUND, RECEIPT_QR_SIZE, RECEIPT_COPY } from './Receipt.constants';
import type { ReceiptQrProps } from './Receipt.types';

/**
 * The props this component uses. Declared here rather than imported: react-qr-code's
 * shipped declaration resolves its `React` against a copy that is not present at
 * this level, so its `QRCodeProps` loses the SVG props under React 19. The runtime
 * export is a plain forwardRef component that accepts exactly these.
 *
 * Same boundary as `components/merchant/MerchantQr.tsx`, for the same reason.
 */
interface ReceiptQrCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  bgColor?: string;
  fgColor?: string;
  title?: string;
  style?: CSSProperties;
}

const QRCode = QRCodeBase as unknown as ComponentType<ReceiptQrCodeProps>;

/**
 * The shareable link, as a code the other party can scan.
 *
 * The card is held up to a merchant, and the fastest way in is a camera — so the
 * card carries the SAME link the Share action hands out, encoded exactly, never a
 * second payload. It is part of the document, not a screen affordance, and so it
 * prints: a QR survives on paper where a "Copy link" button does not.
 *
 * The tile is what guarantees the light field the code is read against; the code
 * itself is drawn in the two literal colours a QR needs to stay scannable.
 */
export function ReceiptQr({ value }: ReceiptQrProps) {
  return (
    <figure className="mt-6 flex flex-col items-center gap-3 border-t border-hairline-dark pt-5">
      <div className="w-40 rounded-md bg-canvas-light p-3">
        <QRCode
          value={value}
          size={RECEIPT_QR_SIZE}
          level="M"
          fgColor={RECEIPT_QR_FOREGROUND}
          bgColor={RECEIPT_QR_BACKGROUND}
          title={RECEIPT_COPY.qrCaption}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      <figcaption className="text-caption text-on-dark-mute">{RECEIPT_COPY.qrCaption}</figcaption>
    </figure>
  );
}
