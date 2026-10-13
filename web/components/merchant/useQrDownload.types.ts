import type { RefObject } from 'react';

/** The rendered SVG's wrapper, and the download action bound to it. */
export interface QrDownload {
  /** Attach to the element that CONTAINS the rendered `<svg>`. */
  wrapper: RefObject<HTMLDivElement | null>;
  /** Serialise the rendered SVG at print size and download it. */
  download: () => void;
}
