/**
 * The one code plate: a branded QR, drawn here as vector, on a light canvas.
 *
 * Every QR this app draws for a person to scan is a code READ by a machine, so three
 * things decide whether it works — contrast, the quiet zone, and how much of the
 * symbol is left intact. All three are geometry. The brand is a fourth, and it is
 * spent out of the first three rather than painted over them.
 *
 *  - **Contrast is INK, and it is the maximum a code can have.** `#000000` is
 *    `--color-canvas-dark` (`web/app/globals.css`); a literal here because this colour
 *    goes into an SVG attribute a machine reads, not into a class a person styles. Black
 *    on the white plate is **21.00:1**: the symbol contrast is 1.00 against the 0.20 a
 *    scanner needs. The plate drew in cobalt-violet for a while, at 6.06:1 — 0.88 of
 *    this, by definition — and the traded margin bought nothing a reader could see on a
 *    surface this small. Cobalt is the brand accent and the design system keeps it
 *    scarce on marketing surfaces; a code is a document, and its ink is not decoration.
 *    Every module keeps its FULL dark area too — corners rounded, module not shrunk to
 *    a dot, and neighbours overlapping by 3% so no white seam grows between them. A
 *    "pretty" code of 70% dots throws away a third of the dark area the contrast was
 *    measured on; this one throws away none of it.
 *  - **The quiet zone travels inside the SVG.** Four clean modules, in the viewBox. That
 *    is the difference that matters: the download rasterises the SVG on its own, where
 *    CSS padding does not exist, and a printed code with no margin is a code a scanner
 *    cannot find. The plate adds NO padding of its own — the white around the modules in
 *    a Seti code is exactly the four modules ISO 18004 requires, so the code fills the
 *    plate instead of floating in a second, decorative margin.
 *  - **Error correction is H (30%)** because the mark sits in the middle of the
 *    symbol and the well under it erases real modules. At 26% of the code's own width
 *    the mark is 8, 9 or 11 modules across as the payload grows (29, 33, 41 modules at
 *    level H), the well around it is two modules wider, and the erased area is 11.9%,
 *    11.1% or 10.1% of the symbol — a third of what H can correct. The decodes in the
 *    PR are the evidence; this arithmetic only says where to look.
 *  - **The mark is ink too**, from the design kit's own generator
 *    (`design-kit/seti.live/marks/`), because the cream mark is 1.3:1 on a white well
 *    and reads as two eyes with no head. Mark and modules being one ink is what makes
 *    the code a brand object rather than a logo stuck on a QR code.
 *
 * The arithmetic, at the one plate size (a 320px plate, with the code filling it) and at
 * the size a download writes:
 *
 * | payload | modules | module on screen | quiet zone | mark | well |
 * | --- | --- | --- | --- | --- | --- |
 * | 29 (v3, a username) | 37 with the zone | 8.65px | 34.6px | 69px | 87px |
 * | 33 (v4, a business) | 41 with the zone | 7.80px | 31.2px | 70px | 86px |
 * | 41 (v6, an address) | 49 with the zone | 6.53px | 26.1px | 72px | 85px |
 *
 * and at 1024px that 33-module code is 24.98px per module with a 100px quiet zone, so
 * a 35mm code printed at 300dpi (~413px) is a downscale, not an upscale. The mark
 * holds one size, ~70px, whatever the payload: it scales with the module COUNT while
 * the module itself shrinks.
 */
export const QR_COLOURS = {
  /**
   * `--color-canvas-dark`. Modules, finder patterns and the mark are one ink, and it is
   * the darkest the system has: a code is read at 21.00:1 here, which is the whole
   * margin a camera gets to lose.
   */
  modules: '#000000',
  /** The plate, and the quiet zone around the code. */
  plate: '#ffffff',
} as const;

export const QR_GEOMETRY = {
  /** The SVG's viewBox width, in user units. CSS scales it; it stays vector. */
  size: 256,
  /** 30% recovery, so the mark's well cannot cost a decode. */
  level: 'H',
  /** ISO 18004 wants four clean modules on every side. Inside the viewBox. */
  quietZone: 4,
  /** Corner rounding, as a share of one module. Rounded, never a shrunken dot. */
  moduleRadius: 0.3,
  /** How far each run grows into its neighbour, so modules fuse instead of touching. */
  moduleBleed: 0.03,
  /** Finder patterns: a thick rounded ring around a rounded core, in module units. */
  finderRingRadius: 1.9,
  finderHoleRadius: 0.95,
  finderCoreRadius: 0.85,
  /** The mark's side, as a share of the code's own width (not the plate's). */
  markShare: 0.26,
  /** Clear modules kept between the mark and live data, on every side. */
  markWellPad: 1,
  /** Below this the mark is unreadable, whatever the share says. */
  markMinModules: 5,
  /** The well's corner rounding, as a share of its own side: a squircle, not a disc. */
  wellRadius: 0.26,
} as const;

export const QR_PLATE = {
  /**
   * A light canvas at the ONE surface radius, with the quiet zone already inside the
   * SVG — and NO padding of its own. The white a reader sees around the modules is the
   * four modules ISO 18004 requires, exactly, so the code fills the plate instead of
   * sitting inside a second, decorative margin nobody can justify. `overflow-hidden`
   * is what lets the plate's 12px corner round the SVG's own white background while
   * the quiet zone (26px at the smallest payload) keeps every corner module clear of
   * the arc.
   *
   * The plate's WIDTH is set on the element from `QrPlate`'s `width` prop (20rem by
   * default, capped at `max-width: 100%`), so a surface can hold the same plate at its
   * own size instead of styling a second one, and a 320px phone clamps it rather than
   * overflowing.
   */
  plate: 'overflow-hidden rounded-md bg-canvas-light',
  /** The width every surface gets unless it asks for another one. */
  width: '20rem',
  /** The plate positions the mark; the mark's WIDTH comes from the geometry. */
  frame: 'relative',
  mark: 'pointer-events-none absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2',
  /** The SVG fills the plate's inner box and keeps its aspect. */
  svg: 'block h-auto w-full',
} as const;

/**
 * The PNG a download writes: 1024px square.
 *
 * The code is drawn from the vector, so this is the resolution a printer wants
 * (a 35mm code at 300dpi is ~413px, so 1024 leaves room to print it twice that)
 * rather than a rescale of a raster that was already soft.
 */
export const QR_EXPORT_PX = 1024;
