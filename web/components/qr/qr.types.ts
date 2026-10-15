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
   * Draws the control that saves the code as a PNG. Absent means no control: a
   * printed code is what a download is for, and a code nobody prints does not need
   * one.
   */
  download?: QrDownload;
  /** Extra classes for the plate, merged onto the shared geometry. */
  className?: string;
}
