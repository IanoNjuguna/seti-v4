/**
 * The one code, in two tones: ink on a white plate, or white on the dark canvas.
 *
 * Every QR this app draws for a person to scan is a code READ by a machine, so three
 * things decide whether it works — contrast, the quiet zone, and how much of the
 * symbol is left intact. All three are geometry. The brand is a fourth, and it is
 * spent out of the first three rather than painted over them.
 *
 *  - **Contrast is the maximum both tones can have.** Ink `#000000` on the white plate
 *    is `--color-canvas-dark` against `--color-canvas-light`; `#ffffff` on the dark
 *    canvas is the same pair the other way round. Both are **21.00:1**, a symbol
 *    contrast of 1.00 against the 0.20 a scanner needs. The literal lives here because
 *    it goes into an SVG attribute a machine reads, not into a class a person styles.
 *    The plate drew in cobalt-violet for a while, at 6.06:1 — 0.88 of this, by
 *    definition — and the traded margin bought nothing a reader could see on a surface
 *    this small: cobalt is the brand accent, and a code is a document.
 *    Every module keeps its FULL dark area too — corners rounded, module not shrunk to
 *    a dot, and neighbours overlapping by 3% so no seam grows between them. A "pretty"
 *    code of 70% dots throws away a third of the dark area the contrast was measured
 *    on; this one throws away none of it.
 *  - **The quiet zone travels inside the SVG.** Four clean modules, in the viewBox. That
 *    is the difference that matters: the download rasterises the SVG on its own, where
 *    CSS padding does not exist, and a printed code with no margin is a code a scanner
 *    cannot find. Neither tone adds padding of its own — the light around the modules is
 *    exactly the four modules ISO 18004 requires, so the code fills whatever it stands
 *    in instead of floating in a second, decorative margin.
 *  - **Error correction is H (30%)** because the mark sits in the middle of the
 *    symbol and the well under it erases real modules. At 26% of the code's own width
 *    the mark is 8, 9 or 11 modules across as the payload grows (29, 33, 41 modules at
 *    level H), the well around it is two modules wider, and the erased area is 11.9%,
 *    11.1% or 10.1% of the symbol — a third of what H can correct. The decodes in the
 *    PR are the evidence; this arithmetic only says where to look.
 *  - **The mark takes the modules' colour**, from the design kit's own generator
 *    (`design-kit/seti.live/marks/`): the cream mark is 1.3:1 on a white well and reads
 *    as two eyes with no head, and the white one is invisible there. Mark and modules
 *    being one colour is what makes the code a brand object rather than a logo stuck on
 *    a QR code, and it is why each tone names its colourway.
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
export const QR_TONES = {
  /**
   * A printed article: ink modules on a white card. The tone every code the app hands a
   * merchant is drawn in, and the one a download writes.
   */
  light: {
    modules: '#000000',
    background: '#ffffff',
    flush: false,
    mark: 'code',
  },
  /**
   * The same code on a band that is already black: white modules, no card of its own,
   * and the mark in the dark colourway. This is what the landing hero holds — a white
   * square in the middle of the hero is the loudest object on the page, and the code
   * does not need one to be found.
   */
  dark: {
    modules: '#ffffff',
    background: '#000000',
    flush: true,
    mark: 'dark',
  },
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
   * The plate each tone stands on. The light one is a white card at the ONE surface
   * radius, with the quiet zone already inside the SVG and NO padding of its own:
   * `overflow-hidden` lets its 12px corner round the SVG's white background while the
   * quiet zone (26px at the smallest payload) keeps every corner module clear of the
   * arc. The dark tone has no card — the band behind it is the field, so there is
   * nothing to draw and nothing to clip.
   *
   * The WIDTH is set on the element from `QrPlate`'s `width` prop (20rem by default,
   * capped at `max-width: 100%`), so a surface can hold the same code at its own size
   * instead of styling a second one, and a 320px phone clamps it rather than
   * overflowing.
   */
  plate: {
    light: 'overflow-hidden rounded-md bg-canvas-light',
    dark: '',
  },
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
