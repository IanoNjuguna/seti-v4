'use client';

import { useCallback, useRef, useState } from 'react';
import { QR_EXPORT_PX } from './qr.constants';

export type QrDownloadState = 'idle' | 'busy' | 'failed';

/**
 * Saves the code inside `ref` as a PNG, drawn from the vector.
 *
 * The SVG is serialized and re-drawn through an `Image` onto a square canvas at
 * `QR_EXPORT_PX`, filled white first — the code's own background is transparent
 * once it leaves the plate, and a transparent PNG of a QR is a black code on
 * whatever the printer decides, which is how a downloaded code comes back
 * unscannable.
 *
 * The failure is a STATE, not a thrown error: this runs in a click handler, and a
 * rejected promise there is a control that silently does nothing. `failed` is what
 * the customer is shown instead.
 */
export function useDownloadQr(filename: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<QrDownloadState>('idle');

  const download = useCallback(async () => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) {
      setState('failed');
      return;
    }

    setState('busy');

    try {
      const markup = new XMLSerializer().serializeToString(svg);
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

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, QR_EXPORT_PX, QR_EXPORT_PX);
      context.drawImage(image, 0, 0, QR_EXPORT_PX, QR_EXPORT_PX);
      URL.revokeObjectURL(svgUrl);

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
  }, [filename]);

  return { ref, state, download };
}
