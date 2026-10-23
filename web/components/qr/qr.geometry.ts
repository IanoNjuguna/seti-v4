import { QR_GEOMETRY } from './qr.constants';
import { encodeQr } from './qr.encoder';
import type { QrFinder, QrGeometry, QrModuleMatrix, QrRect } from './qr.types';

/**
 * Every number one code draws, in the SVG's own user units — the single source the
 * page, the export and the print share.
 *
 * Nothing here is React and nothing here reads the DOM: given the payload it returns
 * the geometry, so the same code that renders the `<svg>` can also be checked against
 * a decoder in a test, and the export cannot drift from what is on screen.
 *
 * Three shapes make up a code:
 *
 *  - **Dark runs.** One rounded rect per horizontal run of dark modules, not per
 *    module: it halves the DOM and, more to the point, it makes a row of modules one
 *    continuous rounded bar instead of a row of beads. Each run grows by `moduleBleed`
 *    into its neighbours so stacked rows fuse — no hairline of white inside a block of
 *    data, which is what a "dotted" QR quietly loses.
 *  - **Finder patterns.** The 7×7 corner pattern as a rounded ring with a rounded core,
 *    in the proportions a decoder scans for (1:1:3:1:1 through the centre). Only the
 *    corners are rounded, so the run lengths it measures are untouched.
 *  - **The well.** A white squircle over the middle of the symbol, wider than the mark
 *    by `markWellPad` modules on every side. Modules whose centre falls inside it are
 *    not drawn at all, and the well is painted over what is left, so its edge is crisp
 *    rather than a staircase of half-covered modules.
 */
const PRECISION = 1000;

const { size, quietZone, moduleRadius, moduleBleed } = QR_GEOMETRY;

function round(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

function rect(x: number, y: number, width: number, height: number, radius: number): QrRect {
  return { x: round(x), y: round(y), width: round(width), height: round(height), radius: round(radius) };
}

/** The left edge of a module, in user units, quiet zone included. */
function edge(index: number, unit: number): number {
  return (quietZone + index) * unit;
}

function isFinder(row: number, col: number, count: number): boolean {
  const far = count - 7;
  return (row < 7 && (col < 7 || col >= far)) || (row >= far && col < 7);
}

function finderPatterns(count: number, unit: number): QrFinder[] {
  const corners: Array<[number, number]> = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];

  return corners.map(([row, col]) => {
    const x = edge(col, unit);
    const y = edge(row, unit);
    return {
      ring: rect(x, y, unit * 7, unit * 7, unit * QR_GEOMETRY.finderRingRadius),
      hole: rect(
        x + unit,
        y + unit,
        unit * 5,
        unit * 5,
        unit * QR_GEOMETRY.finderHoleRadius
      ),
      core: rect(
        x + unit * 2,
        y + unit * 2,
        unit * 3,
        unit * 3,
        unit * QR_GEOMETRY.finderCoreRadius
      ),
    };
  });
}

interface WellSpan {
  centre: number;
  half: number;
}

function isUnderWell(row: number, col: number, unit: number, well: WellSpan): boolean {
  const x = edge(col, unit) + unit / 2;
  const y = edge(row, unit) + unit / 2;
  return Math.abs(x - well.centre) <= well.half && Math.abs(y - well.centre) <= well.half;
}

function darkRuns(matrix: QrModuleMatrix, unit: number, well: WellSpan): QrRect[] {
  const count = matrix.length;
  const runs: QrRect[] = [];

  matrix.forEach((modules, row) => {
    let start = -1;

    const push = (from: number, to: number) => {
      if (from < 0) return;
      const width = (to - from + 1) * unit;
      runs.push(
        rect(
          edge(from, unit) - unit * moduleBleed,
          edge(row, unit) - unit * moduleBleed,
          width + unit * moduleBleed * 2,
          unit + unit * moduleBleed * 2,
          unit * moduleRadius
        )
      );
    };

    for (let col = 0; col <= count; col += 1) {
      const drawn =
        col < count && modules[col] && !isFinder(row, col, count) && !isUnderWell(row, col, unit, well);

      if (drawn && start < 0) start = col;
      if (!drawn && start >= 0) {
        push(start, col - 1);
        start = -1;
      }
    }
  });

  return runs;
}

/**
 * The geometry of one code, or `null` when the payload cannot be encoded at level H.
 *
 * A payload that does not fit draws no code: an empty well inside a plate is a truer
 * statement than a code that carries a different string, and every surface that shows
 * a code also prints the same string as text.
 */
export function buildQrGeometry(value: string): QrGeometry | null {
  const matrix = encodeQr(value);
  if (!matrix) return null;

  const count = matrix.length;
  const unit = size / (count + quietZone * 2);

  const markModules = Math.max(QR_GEOMETRY.markMinModules, Math.round(count * QR_GEOMETRY.markShare));
  const wellModules = markModules + QR_GEOMETRY.markWellPad * 2;
  const wellSide = wellModules * unit;
  const markSide = markModules * unit;
  const from = (size - wellSide) / 2;
  const well = rect(from, from, wellSide, wellSide, wellSide * QR_GEOMETRY.wellRadius);
  const wellSpan: WellSpan = { centre: size / 2, half: wellSide / 2 };

  return {
    size,
    modules: count,
    runs: darkRuns(matrix, unit, wellSpan),
    finders: finderPatterns(count, unit),
    well,
    mark: rect((size - markSide) / 2, (size - markSide) / 2, markSide, markSide, 0),
    markWidth: `${round((markSide / size) * 100)}%`,
  };
}
