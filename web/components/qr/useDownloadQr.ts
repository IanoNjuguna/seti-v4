'use client';

import { useCallback, useState } from 'react';
import { BRAND_MARK_SRC } from '@/components/ui/BrandMark.constants';
import { QR_EXPORT_PX } from './qr.constants';
import { readQrCode } from './qr.register';
import type { BrandCanvas } from '@/components/ui/BrandMark.types';
import type { QrGeometry } from './qr.types';

export type QrDownloadState = 'idle' | 'busy' | 'failed';

/**
 * Saves the code the plate registered as a PNG, drawn from the vector.
 *
 * The SVG is serialized and re-drawn through an `Image` onto a square canvas at
 * `QR_EXPORT_PX`. Everything a code needs is INSIDE that SVG — the four-module quiet
 * zone, the rounded modules, the cut-out well, and the field when the tone carries one —
 * because the moment a code leaves the page it loses the page's CSS, and a code that
 * arrives with no margin and a transparent background has handed its contrast to the
 * printer. A flushed (dark) tone carries no field in the SVG, so the PNG gets one from
 * `tone.background` here: white modules on nothing print as a blank page. The ONE thing
 * that cannot live in a serialized vector is the mark: an SVG loaded as an image
 * fetches nothing, so an `<image href>` inside it would arrive empty. It is drawn here
 * instead, from the same asset the page shows, sized from the same geometry
 * (`geometry.mark`) that cleared the well for it.
 *
 * It finds the code through `readQrCode`, not through a ref, because the download
 * control is placed by the half rather than inside the plate. Before that registry
 * existed this hook took a ref nothing ever attached, so every save failed on a null
 * element and told the customer the browser had refused.
 *
 * The failure is a STATE, not a thrown error: this runs in a click handler, and a
 * rejected promise there is a control that silently does nothing. `failed` is what the
 * customer is shown instead. A mark that will not load is NOT a failure — a code is
 * complete without it — so it degrades to a bare code rather than to no download.
 */
export function useDownloadQr(filename: string, value?: string) {
  const [state, setState] = useState<QrDownloadState>('idle');

  const download = useCallback(async () => {
    const registration = readQrCode(value);
    if (!registration) {
      setState('failed');
      return;
    }

    setState('busy');

    try {
      const markup = new XMLSerializer().serializeToString(registration.svg);
      const svgUrl = URL.createObjectURL(
        new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
      );
      const image = new Image();

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('the code did not draw'));
        image.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = QR_EXPORT_PX;
      canvas.height = QR_EXPORT_PX;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d context');

      context.fillStyle = registration.tone.background;
      context.fillRect(0, 0, QR_EXPORT_PX, QR_EXPORT_PX);
      context.drawImage(image, 0, 0, QR_EXPORT_PX, QR_EXPORT_PX);
      URL.revokeObjectURL(svgUrl);

      await drawMark(context, registration.geometry, registration.tone.mark);

      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!png) throw new Error('no png');

      const pngUrl = URL.createObjectURL(png);
      const anchor = document.createElement('a');
      anchor.href = pngUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(pngUrl);

      setState('idle');
    } catch {
      setState('failed');
    }
  }, [filename, value]);

  return { state, download };
}

/**
 * The mark, in the exported PNG, at the size and place the vector reserved for it.
 *
 * Loaded from the same public asset `BrandMark` serves, at its full 384px — not copied
 * out of the `<img>` on screen, which is a downscaled candidate chosen for a ~60px
 * slot: drawing that at 225px in a 1024px PNG would upscale a raster the printer is
 * about to read.
 */
async function drawMark(
  context: CanvasRenderingContext2D,
  geometry: QrGeometry,
  canvas: BrandCanvas
): Promise<void> {
  const mark = await loadMark(canvas);
  if (!mark) return;

  const scale = QR_EXPORT_PX / geometry.size;
  context.drawImage(
    mark,
    geometry.mark.x * scale,
    geometry.mark.y * scale,
    geometry.mark.width * scale,
    geometry.mark.height * scale
  );
}

/** The mark as a drawable image, in the tone's own colourway, or nothing if it will not load. */
function loadMark(canvas: BrandCanvas): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = BRAND_MARK_SRC.neutral[canvas];
  });
}
