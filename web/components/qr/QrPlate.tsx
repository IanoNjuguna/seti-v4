'use client';

import { QRCode } from '@/components/merchant/qr-code';
import { Button, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { QR_PLATE } from './qr.constants';
import { useDownloadQr } from './useDownloadQr';
import type { QrPlateProps } from './qr.types';

/**
 * A vector QR on the one receive-code plate, with the control that saves it.
 * See `qr.constants.ts` for the contrast and quiet-zone rules this geometry
 * exists to satisfy.
 *
 * `'use client'` because `react-qr-code` is a CLASS component and RSC renders
 * only functions. It still server-renders into the static HTML, so the code — and
 * the exact string it carries — is in the page a crawler or a JS-disabled browser
 * receives; that is what makes the payload provable from the rendered DOM rather
 * than only from a live browser.
 *
 * The accessible name is on the code, not on the figure around it: `role="img"`
 * plus the SVG's own `<title>`, so the caption beside it stays readable as text
 * and the code is one labelled image rather than an unlabelled one with a
 * paragraph glued to it.
 *
 * The download control sits UNDER the plate, not inside it: the plate's white is
 * the code's quiet zone, and a button drawn in it is a control printed on the
 * thing being scanned.
 */
export function QrPlate({ value, title, download, className }: QrPlateProps) {
  const { ref, state, download: save } = useDownloadQr(download?.filename ?? 'qr.png');

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(QR_PLATE.plate, className)}>
        <div ref={ref} role="img" aria-label={title}>
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

      {download ? (
        <>
          <Button variant="ghost" onClick={() => void save()} loading={state === 'busy'}>
            {state === 'busy' ? download.working : download.label}
          </Button>
          {state === 'failed' ? (
            <Text variant="micro" as="p" color="alert">
              {download.failed}
            </Text>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
