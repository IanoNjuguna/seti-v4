import type { BrandCanvas } from '@/components/ui/BrandMark.types';

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

/**
 * Which way round a code is drawn: ink on a white field, or white on the page's own
 * dark canvas.
 *
 * Both are the SAME code — same modules, same quiet zone, same level H, same mark — so
 * a tone is a surface's choice and never a second symbol. `light` is the printed
 * article (and the one a download writes); `dark` is for a band that is already black,
 * where a white card in the middle of the hero is the loudest object on the page.
 */
export type QrToneName = 'light' | 'dark';

/** The colours one tone needs. */
export interface QrTone {
  /** The ink the modules and finder patterns are drawn in. */
  modules: string;
  /** The field the code stands on, in the DOM and in an exported PNG. */
  background: string;
  /**
   * Whether the code stands ON the surface rather than in a field of its own.
   *
   * A flushed tone paints no background in the SVG: the band behind the code shows
   * through the quiet zone and the cut-outs, which is what lets a white code sit on a
   * black hero without a card. The field is kept anyway, because the export fills a PNG
   * and a transparent PNG of white modules prints as a blank page.
   */
  flush: boolean;
  /** Which colourway of the mark fills the well: the same colour as the modules. */
  mark: BrandCanvas;
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
  /**
   * The plate's width, capped at the space it is given (`max-width: 100%`).
   *
   * A surface that holds the code as its leading object (the landing hero) asks for
   * more room than a half of a receive screen; the arithmetic that makes a code
   * scannable scales with the module, so the plate can grow without a second recipe.
   * The cap is a `max-width` rather than a `min(…, 100%)` because a percentage inside
   * the width resolves against a parent that is itself sized by its content: the caption
   * beside the hero's code was silently deciding the code's width.
   */
  width?: string;
  /**
   * Which way round to draw it. `light` (the default) is ink on the plate; `dark` is
   * white on the surface, with no plate of its own at all.
   */
  tone?: QrToneName;
  /** Extra classes for the plate, merged onto the shared geometry. */
  className?: string;
}

/** The control that saves a code as a PNG: the same hook, placed by the half. */
export interface QrDownloadControlProps {
  download: QrDownload;
  /**
   * The payload of the code this control saves.
   *
   * Optional, because a surface draws one code: the half passes nothing and the plate
   * that is mounted is the one saved. Pass it when a page draws more than one — with
   * two codes mounted an unnamed request is refused rather than guessed, so a
   * merchant cannot download somebody else's link.
   */
  value?: string;
}

/** A payload as rows of dark/light modules, as `qrcode-generator` reports it. */
export type QrModuleMatrix = boolean[][];

/**
 * One drawn shape, in the SVG's own user units — never pixels.
 *
 * Everything the code is made of is a rounded rectangle: a run of dark modules, one
 * band of a finder pattern, the white well the mark sits in. Keeping them as data
 * rather than markup means the export can be checked against the same numbers the
 * page draws.
 */
export interface QrRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius, in user units. `0` is a square. */
  radius: number;
}

/** A finder pattern: a rounded ring, the light ring inside it, and the core. */
export interface QrFinder {
  ring: QrRect;
  hole: QrRect;
  core: QrRect;
}

/**
 * Everything one code draws, in user units.
 *
 * `size` is the viewBox width AND the width the quiet zone is measured inside, so a
 * code is complete before any CSS touches it — which is what lets the exported PNG
 * carry its own margin with no knowledge of the plate.
 */
export interface QrGeometry {
  /** The viewBox width; the four-module quiet zone is inside it. */
  size: number;
  /** Modules across the symbol itself (29, 33, 41 …), quiet zone excluded. */
  modules: number;
  /** Dark runs, already merged along a row, so the DOM stays in the low hundreds. */
  runs: QrRect[];
  finders: QrFinder[];
  /** The light well: the ink is cut away under it and the surface shows through. */
  well: QrRect;
  /** The mark's own square, centred in the well. */
  mark: QrRect;
  /**
   * The mark's width as a CSS percentage of the box it is drawn in.
   *
   * A raster mark cannot be sized in user units by CSS, so this is the one value
   * that crosses from the vector into the layout; the export multiplies `mark` by
   * its own scale instead and never reads this.
   */
  markWidth: string;
}

/** A code mounted in the document, before the export draws it. */
export interface QrRegistration {
  svg: SVGSVGElement;
  geometry: QrGeometry;
  /** The tone it was drawn in, so the export fills the field the code expects. */
  tone: QrTone;
}

/** The vector itself: one `<svg>` carrying the whole code, quiet zone included. */
export interface QrCodeSvgProps {
  /** The payload, so the mounted code can be found by what it carries. */
  value: string;
  /** The SVG's own `<title>`, and the accessible name when it stands alone. */
  title: string;
  geometry: QrGeometry;
  /** The ink, the field and the mark's colourway, for this surface. */
  tone: QrTone;
}

/** The mark in the middle: a raster, so only its width comes from the geometry. */
export interface QrPlateMarkProps {
  /** A CSS percentage of the box the code is drawn in. */
  width: string;
  /** The colourway that matches the ink around it. */
  canvas: BrandCanvas;
}
