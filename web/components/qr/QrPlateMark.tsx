import { BrandMark } from '@/components/ui';
import { QR_PLATE } from './qr.constants';
import type { QrPlateMarkProps } from './qr.types';

/**
 * The Seti mark, in the middle of the code, in the well the geometry cut for it.
 *
 * `neutral`, not `friendly`: a code is a document — it is the thing a stranger scans
 * and a printer prints — and the kit's role map puts documents on the neutral face.
 *
 * THE COLOURWAY IS THE TONE'S, and the two are not interchangeable: `code` is the ink
 * head the kit generates for a white well, `dark` is the white head with its eyes
 * punched. Whichever it is, it is the SAME colour as the modules around it, which is
 * what makes the code read as one object instead of a logo stuck on a QR code. A mark
 * in any other colour is 1.3:1 or 1:1 on that well.
 *
 * It is a raster laid over the vector rather than an `<image>` inside it, because a
 * serialised SVG loaded as an image will not fetch an external href. The export draws
 * the same mark at the same place — see `useDownloadQr`.
 */
export function QrPlateMark({ width, canvas }: QrPlateMarkProps) {
  return (
    <span aria-hidden="true" className={QR_PLATE.mark} style={{ width }}>
      <BrandMark expression="neutral" canvas={canvas} className="h-full w-auto" />
    </span>
  );
}
