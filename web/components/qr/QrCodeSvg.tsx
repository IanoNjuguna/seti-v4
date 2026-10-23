import { useEffect, useRef } from 'react';
import { QR_COLOURS, QR_PLATE } from './qr.constants';
import { registerQrCode } from './qr.register';
import type { QrCodeSvgProps, QrRect } from './qr.types';

/**
 * The code itself, as one `<svg>`: quiet zone, rounded modules, rounded finders, the
 * white well for the mark. Geometry in, markup out — every number comes from
 * `qr.geometry.ts`, so what the export rasterises and what the eye sees are the same
 * shapes.
 *
 * It registers itself so the download control can find it: the control is placed by
 * the half, beside the plate rather than inside it, and a ref cannot cross that.
 *
 * Three things the markup guarantees regardless of CSS:
 *
 *  - an explicit `xmlns`, because the export serialises this element and loads it as
 *    its own SVG image — without the namespace that image fails to draw at all;
 *  - an opaque plate rect filling the viewBox, so the exported PNG has a white
 *    background from the vector rather than from a `fillRect` someone has to remember;
 *  - the well painted over the data, so its edge is a clean curve and not a staircase
 *    of half-covered modules.
 */
export function QrCodeSvg({ value, title, geometry }: QrCodeSvgProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    return registerQrCode(value, { svg, geometry });
  }, [value, geometry]);

  const side = geometry.size;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${side} ${side}`}
      className={QR_PLATE.svg}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect width={side} height={side} fill={QR_COLOURS.plate} />
      <g fill={QR_COLOURS.modules}>
        {geometry.runs.map((run, index) => (
          <rect key={`run-${index}`} {...svgRect(run)} />
        ))}
        {geometry.finders.map((finder, index) => (
          <g key={`finder-${index}`}>
            <rect {...svgRect(finder.ring)} />
            <rect {...svgRect(finder.hole)} fill={QR_COLOURS.plate} />
            <rect {...svgRect(finder.core)} />
          </g>
        ))}
      </g>
      <rect {...svgRect(geometry.well)} fill={QR_COLOURS.plate} />
    </svg>
  );
}

/** Our geometry calls it `radius`; SVG calls it `rx`, once, here. */
function svgRect({ x, y, width, height, radius }: QrRect) {
  return { x, y, width, height, rx: radius };
}
