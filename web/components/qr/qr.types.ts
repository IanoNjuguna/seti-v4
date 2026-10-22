/** What a code's download control needs to say, and what file it writes. */
export interface QrDownload {
  /** The file it writes, without a path: `seti-ian-qr.png`. */
  filename: string;
  /** The control's word. */
  label: string;
  /** While the PNG is being drawn. */
  working: string;
  /** Shown when the browser refused — a download the customer cannot see. */
  failed: string;
}

export interface QrPlateProps {
  /** The exact string the code encodes. */
  value: string;
  /**
   * The code's accessible name, and the SVG's own `<title>`.
   *
   * It must say what scanning the code DOES — a code can carry a link, an
   * address or a payment request, and "QR code" tells a screen-reader user
   * nothing about which.
   */
  title: string;
  /**
   * Which edge the plate and its controls share.
   *
   * `center` is the default and suits a card that draws a single code. `start` is for
   * the receive halves, which sit on one left-aligned axis: a centred square above
   * left-aligned text is the mixed edge that made the page read as two layouts.
   */
  align?: 'start' | 'center';
  /** Extra classes for the plate, merged onto the shared geometry. */
  className?: string;
}

/** The control that saves a code as a PNG: the same hook, placed by the half. */
export interface QrDownloadControlProps {
  download: QrDownload;
}
