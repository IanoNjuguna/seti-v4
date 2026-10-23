/**
 * Executable spec for the code plate.
 *
 * Run with:  npm run check:qr-plate   (from web/, or the root `verify` gate)
 *
 * `qr.constants.ts` makes four claims and every one of them is arithmetic, so every one
 * of them is checkable. A comment cannot fail, and the numbers that matter here are the
 * kind that rot silently: a token moves, someone "tidies" the module count, the mark
 * grows a module.
 *
 *   1. INK == TOKEN. The modules' colour is a literal (it goes into an SVG attribute a
 *      machine reads), so it must equal `--color-primary` in `app/globals.css`. The
 *      values are read from the stylesheet, never retyped here: a brand change that
 *      moves the token fails this suite instead of shipping a code in last month's
 *      cobalt.
 *   2. MEASUREMENT. The modules must clear 4.5:1 against the plate, and the ratio the
 *      constants quote is the ratio measured.
 *   3. STRUCTURE. Level H, four modules of quiet zone (ISO 18004's minimum), a square
 *      export.
 *   4. BUDGET. The white well may not erase more than 15% of the symbol at any real
 *      payload — a third of the 30% level H corrects, which is the margin the whole
 *      design rests on.
 */
import { readFileSync } from 'node:fs';
import { QR_COLOURS, QR_EXPORT_PX, QR_GEOMETRY, QR_PLATE } from '../components/qr/qr.constants.ts';
import { buildQrGeometry } from '../components/qr/qr.geometry.ts';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const token = (name) => {
  const found = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  return found ? found[1].trim().toLowerCase() : null;
};

const luminance = (hex) => {
  const channels = hex.replace('#', '').match(/../g).map((pair) => parseInt(pair, 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// 1. The literal IS the token.
check('modules are --color-primary', QR_COLOURS.modules === token('primary'), QR_COLOURS.modules);
check('plate is --color-canvas-light', QR_COLOURS.plate === token('canvas-light'), QR_COLOURS.plate);

// 2. The contrast the comment quotes, measured.
const ratio = contrast(QR_COLOURS.modules, QR_COLOURS.plate);
console.log(`      cobalt on plate: ${ratio.toFixed(2)}:1`);
check('modules clear 4.5:1 on the plate', ratio >= 4.5, `${ratio.toFixed(2)}:1`);
check('the quoted 6.06:1 is the measured value', ratio.toFixed(2) === '6.06', ratio.toFixed(3));

// 3. The structure the spec requires.
check('level H', QR_GEOMETRY.level === 'H', QR_GEOMETRY.level);
check('quiet zone is four modules', QR_GEOMETRY.quietZone === 4, QR_GEOMETRY.quietZone);
check('a square export', QR_EXPORT_PX === 1024, QR_EXPORT_PX);
check('plate uses a canvas token, not a colour', QR_PLATE.plate.includes('bg-canvas-light'));

// 4. The well's share of the symbol, at the payloads the app really encodes.
const PAYLOADS = [
  ['a username', 'https://seti.live/u/ian'],
  ['a business', 'https://seti.live/m/javahouse'],
  ['an EIP-681 address', 'ethereum:0x1234567890ABCDEF1234567890abcdef12345678@4217'],
];

for (const [label, payload] of PAYLOADS) {
  const geometry = buildQrGeometry(payload);
  if (!geometry) {
    check(`${label} encodes`, false, 'no geometry');
    continue;
  }

  const unit = geometry.size / (geometry.modules + 2 * QR_GEOMETRY.quietZone);
  const wellShare = (geometry.well.width / unit / geometry.modules) ** 2;
  console.log(
    `      ${label}: ${geometry.modules} modules, well ${(wellShare * 100).toFixed(1)}% of the symbol`
  );
  check(`${label} keeps the well under 15%`, wellShare < 0.15, `${(wellShare * 100).toFixed(1)}%`);
  check(
    `${label} runs are merged`,
    geometry.runs.length < geometry.modules * geometry.modules,
    `${geometry.runs.length} rects`
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
