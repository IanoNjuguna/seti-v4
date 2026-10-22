'use client';

import { QRCode } from '@/components/merchant/qr-code';
import { cn } from '@/lib/cn';
import { QR_PLATE } from './qr.constants';
import type { QrPlateProps } from './qr.types';

/**
 * A vector QR on the one receive-code plate. See `qr.constants.ts` for the contrast
 * and quiet-zone rules this geometry exists to satisfy.
 *
 * The plate carries the CODE and nothing else. The control that saves it used to live
 * here, which put a link between the code and the name underneath it; the name is what
 * the code stands for, so nothing may come between them. `QrDownloadControl` is that
 * control, and the half decides where it sits.
 *
 * `'use client'` because `react-qr-code` is a CLASS component and RSC renders only
 * functions. It still server-renders into the static HTML, so the code, and the exact
 * string it carries, is in the page a crawler or a JS-disabled browser receives.
 *
 * The accessible name is on the code, not on the figure around it: `role="img"` plus
 * the SVG's own `<title>`, so the code is one labelled image rather than an
 * unlabelled one with a paragraph glued to it.
 */
export function QrPlate({ value, title, align = 'center', className }: QrPlateProps) {
  return (
    <div className={align === 'start' ? 'flex flex-col items-start' : 'flex flex-col items-center'}>
      <div className={cn(QR_PLATE.plate, className)}>
        <div role="img" aria-label={title}>
          <QRCode
            value={value}
            size={QR_PLATE.size}
            level={QR_PLATE.level}
            fgColor={QR_PLATE.foreground}
            bgColor={QR_PLATE.background}
            title={title}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
}
