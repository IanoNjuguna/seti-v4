'use client';

import { useEffect, useId, useRef } from 'react';
import { QR_PLATE } from './qr.constants';
import { registerQrCode } from './qr.register';
import type { QrCodeSvgProps, QrGeometry, QrRect } from './qr.types';

/**
 * The code itself, as one `<svg>`: quiet zone, rounded modules, rounded finders, the
 * hole the mark sits in. Geometry in, markup out — every number comes from
 * `qr.geometry.ts`, so what the export rasterises and what the eye sees are the same
 * shapes.
 *
 * THE LIGHT PARTS ARE CUT, NOT PAINTED. The finders' light gaps and the well around the
 * mark were filled with the plate's white, which is correct on a white plate and
 * impossible on a dark canvas: painting `#000` over the hero's field would draw a black
 * square where the page has a lift, a grain and a glow. Both are punched out of the ink
 * with an SVG `mask` now, so whatever is behind the code shows through — the plate's
 * white on a light surface, the page itself when the code carries no plate. The mask id
 * is per instance (`useId`), because two codes on one page would otherwise share one.
 *
 * It registers itself so the download control can find it: the control is placed by
 * the half, beside the plate rather than inside it, and a ref cannot cross that.
 *
 * Three things the markup guarantees regardless of CSS:
 *
 *  - an explicit `xmlns`, because the export serialises this element and loads it as
 *    its own SVG image — without the namespace that image fails to draw at all;
 *  - an opaque background rect on a tone that has one (the light one), so the exported
 *    PNG carries its own white rather than borrowing it from a `fillRect` someone has
 *    to remember;
 *  - the well cut rather than painted, so its edge is a clean curve and not a
 *    staircase of half-covered modules.
 */
export function QrCodeSvg({ value, title, geometry, tone }: QrCodeSvgProps) {
  const ref = useRef<SVGSVGElement>(null);
  const maskId = `qr-cut-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    return registerQrCode(value, { svg, geometry, tone });
  }, [value, geometry, tone]);

  const side = geometry.size;
  const cuts = cutTargets(geometry);

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

      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={side} height={side}>
          <rect width={side} height={side} fill="#ffffff" />
          {cuts.map((rect, index) => (
            <rect key={`cut-${index}`} {...svgRect(rect)} fill="#000000" />
          ))}
        </mask>
      </defs>

      {tone.flush ? null : <rect width={side} height={side} fill={tone.background} />}

      <g fill={tone.modules} mask={`url(#${maskId})`}>
        {geometry.runs.map((run, index) => (
          <rect key={`run-${index}`} {...svgRect(run)} />
        ))}
        {geometry.finders.map((finder, index) => (
          <rect key={`ring-${index}`} {...svgRect(finder.ring)} />
        ))}
      </g>

      {/* The cores come AFTER the cut, not inside it: each sits in its finder's hole, and
          a mask does not care that one rect is meant to be the exception to another. */}
      <g fill={tone.modules}>
        {geometry.finders.map((finder, index) => (
          <rect key={`core-${index}`} {...svgRect(finder.core)} />
        ))}
      </g>
    </svg>
  );
}

/**
 * What the ink is cut around: every finder's light gap, then the well.
 *
 * In that order because they never overlap — a finder is a corner, the well is the
 * centre — and because the well is the cut that must win if they ever did.
 */
function cutTargets(geometry: QrGeometry): QrRect[] {
  return [...geometry.finders.map((finder) => finder.hole), geometry.well];
}

/** Our geometry calls it `radius`; SVG calls it `rx`, once, here. */
function svgRect({ x, y, width, height, radius }: QrRect) {
  return { x, y, width, height, rx: radius };
}
