/**
 * The one receive-code plate: a vector QR on a light canvas.
 *
 * Every QR this app draws for a person to scan is a code READ by a machine, so
 * the two things that matter are the contrast and the quiet zone — and both are
 * geometry, not styling taste.
 *
 *  - **Contrast.** Literal `black` on `white`, as in the landing hero and the
 *    receipt: a brand tint on either one is what stops a code being read. The
 *    PLATE around the code IS a surface and uses tokens (`bg-canvas-light`,
 *    `rounded-md` — the one control/surface radius, 12px).
 *  - **The quiet zone.** The spec wants four clean modules around the code, and
 *    the plate's padding is what provides them. Padding is fixed in pixels while
 *    the code scales with the plate, so the QUIET ZONE only holds up to a capped
 *    width — hence `w-[min(18rem,100%)]`: 36px of padding around the 216px code a
 *    288px plate draws is 4.2 modules of the 33-module (version 4) code an
 *    EIP-681 address encodes, measured in the render rather than assumed. A plate
 *    allowed to grow past that cap keeps the same 36px of padding around a wider
 *    code and the quiet zone silently shrinks below four modules.
 *  - **Vector.** `react-qr-code`, which the receipt, merchant and hero surfaces
 *    already use. Nothing here is a committed PNG: raster at a few hundred pixels
 *    is visibly soft the moment it is zoomed, and it cannot be re-encoded when the
 *    payload changes.
 *
 * `size` is the SVG's own viewBox width; CSS scales it and it stays vector. There
 * is ONE plate size now. The compact variant (9rem / 104px code) existed because a
 * centred stack inside the old card had to fit a phone; with the cards gone the
 * small code has no reason to be small, and the customer scanning it has every
 * reason for it to be twice the size.
 */
export const QR_PLATE = {
  /** The SVG's viewBox size. */
  size: 256,
  level: 'M',
  /** Machine-readable contrast, not a colour choice. */
  foreground: 'black',
  background: 'white',
  /** A light canvas at the ONE surface radius, with the quiet zone in its padding. */
  plate: 'w-[min(18rem,100%)] rounded-md bg-canvas-light p-9',
} as const;

/**
 * The PNG a download writes: 1024px square.
 *
 * The code is drawn from the vector, so this is the resolution a printer wants
 * (a 35mm code at 300dpi is ~413px, so 1024 leaves room to print it twice that)
 * rather than a rescale of a raster that was already soft.
 */
export const QR_EXPORT_PX = 1024;
