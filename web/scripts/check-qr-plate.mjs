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
 *   1. INK == TOKEN, IN BOTH TONES. A tone's colours are literals (they go into SVG
 *      attributes a machine reads), so each must equal the canvas token it inverts:
 *      `light` is `--color-canvas-dark` ink on `--color-canvas-light`, `dark` is the
 *      pair the other way round. The values are read from the stylesheet, never retyped
 *      here: a palette change that moves the token fails this suite instead of shipping
 *      a code in last month's ink.
 *   2. MEASUREMENT. The modules must clear 4.5:1 against their field — both tones clear
 *      21.00:1 — and the ratios the constants quote are the ratios measured.
 *   3. STRUCTURE. Level H, four modules of quiet zone (ISO 18004's minimum), a square
 *      export, and a plate that paints a field ONLY where the tone owns one.
 *   4. BUDGET. The cut-out well may not erase more than 15% of the symbol at any real
 *      payload — a third of the 30% level H corrects, which is the margin the whole
 *      design rests on.
 */
import { readFileSync } from 'node:fs';
import { QR_EXPORT_PX, QR_GEOMETRY, QR_PLATE, QR_TONES } from '../components/qr/qr.constants.ts';
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

// 1. Each tone's literals ARE the tokens they invert.
check(
  'light draws in --color-canvas-dark',
  QR_TONES.light.modules === token('canvas-dark'),
  QR_TONES.light.modules
);
check(
  'light stands on --color-canvas-light',
  QR_TONES.light.background === token('canvas-light'),
  QR_TONES.light.background
);
check(
  'dark draws in --color-canvas-light',
  QR_TONES.dark.modules === token('canvas-light'),
  QR_TONES.dark.modules
);
check(
  'dark stands on --color-canvas-dark',
  QR_TONES.dark.background === token('canvas-dark'),
  QR_TONES.dark.background
);

// 2. The contrast each tone quotes, measured.
for (const [name, tone] of Object.entries(QR_TONES)) {
  const ratio = contrast(tone.modules, tone.background);
  console.log(`      ${name}: ${ratio.toFixed(2)}:1`);
  check(`${name} clears 4.5:1 on its field`, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
  check(`the quoted 21.00:1 is ${name}'s measured value`, ratio.toFixed(2) === '21.00', ratio.toFixed(3));
}

// 3. The structure the spec requires.
check('level H', QR_GEOMETRY.level === 'H', QR_GEOMETRY.level);
check('quiet zone is four modules', QR_GEOMETRY.quietZone === 4, QR_GEOMETRY.quietZone);
check('a square export', QR_EXPORT_PX === 1024, QR_EXPORT_PX);
check('the light plate uses a canvas token, not a colour', QR_PLATE.plate.light.includes('bg-canvas-light'));
check(
  'the dark plate paints no field of its own',
  !/bg-/.test(QR_PLATE.plate.dark),
  QR_PLATE.plate.dark
);
check('a flushed tone is the one with no plate', QR_TONES.dark.flush === true && QR_TONES.light.flush === false);
check(
  "each tone's mark is the colourway for its ink",
  QR_TONES.light.mark === 'code' && QR_TONES.dark.mark === 'dark'
);

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
