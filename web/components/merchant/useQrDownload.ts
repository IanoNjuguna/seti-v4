'use client';

import { useCallback, useRef } from 'react';
import type { QrDownload } from './useQrDownload.types';

/** The file's pixel size. The on-screen code is smaller; an SVG scales to any of it. */
const QR_PRINT_PX = 512;

/**
 * Download the QR as an SVG file, with no backend involved.
 *
 * The rendered SVG is CLONED and resized rather than mutated, so the on-screen size
 * is untouched by a download, and `xmlns` is added because a standalone SVG file
 * needs it. Everything here is browser-only and synchronous — there is nothing to
 * await and nothing to fail on a slow connection.
 *
 * A hook rather than a block inside the component so the QR stays a view: the same
 * serialise-and-download recipe is needed for a person's code and a business's
 * sticker, and two copies of it would drift on the print size.
 */
export function useQrDownload(fileName: string): QrDownload {
  const wrapper = useRef<HTMLDivElement>(null);

  const download = useCallback(() => {
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
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [fileName]);

  return { wrapper, download };
}
