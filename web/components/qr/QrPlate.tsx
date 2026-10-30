'use client';

import { cn } from '@/lib/cn';
import { QrCodeSvg } from './QrCodeSvg';
import { QrPlateMark } from './QrPlateMark';
import { QR_PLATE } from './qr.constants';
import { useQrCode } from './useQrCode';
import type { QrPlateProps } from './qr.types';

/**
 * A branded code on the one receive-code plate. See `qr.constants.ts` for the contrast,
 * quiet-zone and mark-share rules this geometry exists to satisfy.
 *
 * The plate carries the CODE and nothing else. The control that saves it used to live
 * here, which put a link between the code and the name underneath it; the name is what
 * the code stands for, so nothing may come between them. `QrDownloadControl` is that
 * control, and the half decides where it sits.
 *
 * `'use client'` because the code registers itself for the export and an export is a
 * browser operation. It still server-renders into the static HTML, so the code — and
 * the exact string it carries — is in the page a crawler or a JS-disabled browser
 * receives.
 *
 * The accessible name is on the code itself: `role="img"` and `aria-label` on the
 * `<svg>`, with its `<title>` as the thing the vector carries wherever it is copied.
 * It used to be a `role="img"` div wrapping a titled `<svg>`, which Chrome exposes as
 * TWO images with the same name — a screen reader announced every code twice. One
 * element cannot be two images. The mark beside it is `aria-hidden`: it is the same
 * object announced twice otherwise, and what a person needs to hear is what scanning
 * DOES.
 */
export function QrPlate({ value, title, align = 'center', width = QR_PLATE.width, className }: QrPlateProps) {
  const geometry = useQrCode(value);

  return (
    <div className={align === 'start' ? 'flex flex-col items-start' : 'flex flex-col items-center'}>
      <div className={cn(QR_PLATE.plate, className)} style={{ width, maxWidth: '100%' }}>
        {geometry ? (
          <div className={QR_PLATE.frame}>
            <QrCodeSvg value={value} title={title} geometry={geometry} />
            <QrPlateMark width={geometry.markWidth} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
