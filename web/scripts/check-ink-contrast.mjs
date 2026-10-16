/**
 * Executable spec for the app's text INKS.
 *
 * Run with:  npm run check:ink   (from web/, or the root `verify` gate)
 *
 * Why this exists: three of the app's text colours sat below WCAG AA on the
 * surface they were drawn on (`alert` 4.24:1, `warning` 3.07:1, `attention`
 * 2.78:1 on `canvas-light`), and nothing in the repo could tell anyone. The
 * colours were not wrong, the ROLES were: each status role named a fill accent
 * (`accent-danger`, `accent-yellow`, `accent-warning`) that `design/revolut.md`
 * reserves for mockups, chrome and borders, and which is only legible on black.
 *
 * So the rule this suite enforces, in two halves:
 *
 *   1. STRUCTURE. Every status role in `components/ui/Text.constants.ts` must
 *      name an INK token (`text-ink-*`), never a fill accent (`text-accent-*`).
 *      That is the split the doc already made for error (`accent-deep-red` is
 *      "inline error text", `accent-danger` the error STATE) and for success
 *      (`accent-green-text`), generalised to the other two statuses.
 *
 *   2. MEASUREMENT. Every ink/surface pair the app actually draws must clear
 *      4.5:1. The values are read out of `app/globals.css` (never retyped here),
 *      so changing a token to something dimmer fails the suite rather than
 *      shipping.
 *
 * The status inks resolve PER CANVAS (`--color-ink-*` in `:root`, re-pointed
 * inside the app's dark surfaces), so each is measured twice: once against the
 * white band and once against the black. A pair that passes on white is not
 * evidence about the black, which is exactly how the receipt's status line would
 * have been broken by the obvious one-line fix.
 *
 * What this does NOT cover, deliberately: raw `text-stone` used as body copy
 * outside the primitives, i.e. the addresses in `MerchantCard`, `ClaimResult`,
 * `MerchantIdentity`, `PersonIdentity` and `ActivityRowDetail` and the wizard's
 * step separator. The 2026-10-16 audit recorded those as retained, not fixed
 * (`accent-danger`-style reasoning: raising an address to `mute` would put it
 * level with the name above it), they sit in files this change does not own, and
 * a baseline list of them would be false the moment another agent touches one.
 * They are named here so the gap is visible rather than implied.
 */
import { readFileSync } from 'node:fs';

const here = new URL('../', import.meta.url); // the web/ package root
const read = (path) => readFileSync(new URL(path, here), 'utf8');

let total = 0;
let failures = 0;

function check(label, passed, detail = '') {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// A small colour/token model.
// ---------------------------------------------------------------------------
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The same, for TypeScript: block and line comments both carry prose (and the
 * odd semicolon), and this suite reads declarations out of two .ts files.
 */
const stripTsComments = (ts) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** Blocks of a stylesheet as { selector, body }, including nested ones. */
function parseBlocks(css) {
  const blocks = [];
  const stack = [];
  let prelude = '';
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') {
      stack.push(prelude.trim());
      prelude = '';
    } else if (ch === '}') {
      blocks.push({ selector: stack[stack.length - 1] ?? '', body: prelude });
      stack.pop();
      prelude = '';
    } else {
      prelude += ch;
    }
  }
  return blocks;
}

/** Every `--color-*` declaration in blocks whose selector matches `pred`. */
function declarations(blocks, pred) {
  const out = {};
  for (const block of blocks) {
    if (!pred(block.selector)) continue;
    for (const match of block.body.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      out[match[1]] = match[2].trim();
    }
  }
  return out;
}

function resolveHex(name, scope) {
  let value = scope[name];
  if (value === undefined) throw new Error(`token ${name} is not declared in globals.css`);
  for (let hop = 0; hop < 8; hop += 1) {
    const viaVar = value.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
    if (!viaVar) break;
    value = scope[viaVar[1]];
    if (value === undefined) throw new Error(`token ${name} resolves to undeclared ${viaVar[1]}`);
  }
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    return { rgb: [0, 2, 4].map((o) => parseInt(h.slice(o, o + 2), 16)), alpha: 1 };
  }
  const rgba = value.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i,
  );
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`token ${name} has a value this suite cannot measure: ${value}`);
}

/** Flatten a translucent ink over its surface, the way the renderer does. */
function over(ink, surface) {
  if (ink.alpha >= 1) return ink.rgb;
  return ink.rgb.map((c, i) => c * ink.alpha + surface[i] * (1 - ink.alpha));
}

const channel = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ---------------------------------------------------------------------------
// The tokens, as declared.
// ---------------------------------------------------------------------------
const blocks = parseBlocks(stripComments(read('app/globals.css')));

/** The white canvas, and the fills/borders/icons alongside it. */
const light = declarations(blocks, (s) => s === ':root');
/** The same map with every dark surface's re-point layered on top. */
const dark = { ...light, ...declarations(blocks, (s) => s.includes('bg-canvas-dark')) };

// ---------------------------------------------------------------------------
// 1. STRUCTURE: ink roles name ink tokens.
// ---------------------------------------------------------------------------
console.log('structure: status roles name ink tokens, not fill accents');

const constants = stripTsComments(read('components/ui/Text.constants.ts'));

/** Pull `{ role: 'class' }` entries out of one exported object literal. */
function classesFromObject(name) {
  const body = constants.match(new RegExp(`export const ${name}[^\\n]*\\{([\\s\\S]*?)\\n\\};`));
  if (!body) return null;
  const out = {};
  for (const match of body[1].matchAll(/^\s*'?([a-z-]+)'?\s*:\s*'([^']*)'/gm)) {
    out[match[1]] = match[2];
  }
  return out;
}

const roles = classesFromObject('COLOR_CLASSES');
const defaults = classesFromObject('DEFAULT_COLOR_CLASSES');

if (!roles || !defaults) {
  check('COLOR_CLASSES and DEFAULT_COLOR_CLASSES are present in Text.constants.ts', false);
} else {
  for (const role of ['alert', 'warning', 'attention', 'success']) {
    check(
      `${role} maps to its ink token, not a fill accent`,
      roles[role] === `text-ink-${role}`,
      `maps to ${roles[role] ?? '(absent)'}`,
    );
  }
  const fillNamed = Object.entries(roles).filter(([, cls]) => /\btext-accent-[a-z-]+/.test(cls));
  check(
    'no text role names a fill accent (accent-* is for borders, fills and icons)',
    fillNamed.length === 0,
    fillNamed.map(([r, c]) => `${r} -> ${c}`).join(', '),
  );
  check(
    "the micro default is a legible caption ink (ash), not stone",
    defaults.micro === 'text-ash',
    `micro -> ${defaults.micro ?? '(absent)'}`,
  );
}

// Every role the type allows must be covered above, or a new one slips through.
const types = stripTsComments(read('components/ui/Text.types.ts'));
const union = types.match(/export type TextColor\s*=([\s\S]*?);/);
const declaredRoles = union
  ? [...union[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
  : null;
const mappedRoles = roles ? Object.keys(roles) : [];
check(
  'every TextColor role is mapped',
  declaredRoles !== null && declaredRoles.every((r) => mappedRoles.includes(r)),
  declaredRoles ? `roles: ${declaredRoles.join(', ')}` : 'TextColor union not found',
);

// ---------------------------------------------------------------------------
// 2. MEASUREMENT: every ink/surface pair the app draws.
// ---------------------------------------------------------------------------
console.log('\nmeasurement: each ink against the surface it is drawn on (AA is 4.5:1)');

const CANVAS_LIGHT = '--color-canvas-light';
const CANVAS_DARK = '--color-canvas-dark';

const PAIRS = [
  // [ink token, surface token, scope, where it is drawn]
  ['--color-ink', CANVAS_LIGHT, 'light', 'primary: every word on a white band'],
  ['--color-mute', CANVAS_LIGHT, 'light', 'secondary: supporting text on a white band'],
  ['--color-primary', CANVAS_LIGHT, 'light', 'accent: cobalt links on a white band'],
  ['--color-ash', CANVAS_LIGHT, 'light', 'the micro variant default: captions on a white band'],
  ['--color-mute', CANVAS_LIGHT, 'light', "Input light tone: the field's label"],
  ['--color-ash', '--color-surface-soft', 'light', "Input light tone: the field's placeholder"],
  ['--color-on-dark', CANVAS_DARK, 'dark', 'inverse: text on the black chrome'],
  ['--color-on-dark-mute', CANVAS_DARK, 'dark', 'inverse-muted: nav labels and quiet chrome'],
  ['--color-on-dark', '--color-surface-elevated', 'dark', 'inverse: the active destination'],
  ['--color-ink-alert', CANVAS_LIGHT, 'light', 'alert: a refusal on a white band'],
  ['--color-ink-alert', CANVAS_DARK, 'dark', 'alert: a refusal on the receipt card'],
  ['--color-ink-warning', CANVAS_LIGHT, 'light', 'warning: a caution on a white band'],
  ['--color-ink-warning', CANVAS_DARK, 'dark', 'warning: a caution inside the dark quote'],
  ['--color-ink-attention', CANVAS_LIGHT, 'light', 'attention: the practice marker on white'],
  ['--color-ink-attention', CANVAS_DARK, 'dark', 'attention: the practice marker on the chrome'],
  ['--color-ink-success', CANVAS_LIGHT, 'light', 'success: an inflow amount on a white band'],
  ['--color-ink-success', CANVAS_DARK, 'dark', 'success: the receipt status line'],
];

for (const [inkName, surfaceName, scope, where] of PAIRS) {
  const tokens = scope === 'dark' ? dark : light;
  let ratio = null;
  let error = '';
  try {
    const surface = resolveHex(surfaceName, tokens);
    const ink = resolveHex(inkName, tokens);
    ratio = contrast(over(ink, surface.rgb), over(surface, [0, 0, 0]));
  } catch (thrown) {
    error = thrown.message;
  }
  const label = `${inkName.replace('--color-', '')} on ${surfaceName.replace('--color-', '')} (${where})`;
  if (error) {
    check(label, false, error);
  } else {
    check(label, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
  }
}

console.log('-'.repeat(72));
if (failures > 0) {
  console.log(`${failures} CHECK(S) FAILED.`);
  process.exit(1);
}
console.log(`${total} assertions passed.`);
