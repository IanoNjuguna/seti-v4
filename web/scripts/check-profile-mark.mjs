#!/usr/bin/env node
/**
 * `npm run check:profile-mark` — the account's face is OURS, and it is drawn locally.
 *
 * The mark on a profile is the one image on an account page, so it is where two mistakes are
 * cheapest to make and hardest to see: pointing an `<img>` at somebody else's server, and
 * quietly growing a second face beside the first. This suite pins both.
 *
 * ## What it used to assert, and why that changed
 *
 * Until the owner replaced it, the mark was two letters from the username on a tone hashed
 * from it: distinct per account, and this file proved the hash was stable and spread. The
 * decision is now that an account looks like SETI — our smiling alien — and the handle printed
 * beside it identifies the person. So the assertions moved from "the letters and the tone" to
 * "one face, ours, local", plus the one that matters most after a deletion: the initials
 * machinery must not come back as a second, unused face.
 *
 * Run from `web/`: npm run check:profile-mark (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel) => readFileSync(join(WEB, rel), 'utf8');

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${label}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${label}${detail ? `  (${detail})` : ''}`);
}

const mark = read('components/ui/Mark.tsx');
const constants = read('components/ui/Mark.constants.ts');
const types = read('components/ui/Mark.types.ts');
const identity = read('components/profile/ProfileIdentity.tsx');
const csp = read('lib/security-headers.ts');

// --- it is our face ---------------------------------------------------------
console.log('the face\n');
check('the mark draws the brand mark', /<BrandMark\b/.test(mark));
check('and it is the friendly face', /expression="friendly"/.test(mark));
check('on the light canvas, which the neutral well allows', /canvas="light"/.test(mark));
check('in the neutral well, never a tone', /MARK_WELL_CLASS/.test(mark) && /bg-surface-soft/.test(constants));
check('the glyph is set per size, not scaled from the box', /MARK_GLYPH_CLASS\[size\]/.test(mark));

// --- it is local ------------------------------------------------------------
console.log('\nand it is drawn locally\n');
check('the mark makes no request', !/https?:\/\//.test(mark) && !/\bfetch\(/.test(mark));
check('it renders no <img>, so no remote host is involved', !/<img\b/.test(mark.replace(/\/\*[\s\S]*?\*\//g, '')));
check('gravatar is not used as a source', !/gravatar\.com/i.test(mark));
check(
  'the CSP still blocks third-party images',
  /img-src 'self' data: blob:/.test(csp),
  'img-src changed'
);

// --- one face, not two ------------------------------------------------------
console.log('\nand there is exactly one face\n');
/* Comments are stripped first: the component's own doc explains what was REMOVED, and naming
   the helpers there must not read as the helpers being present. */
const markCode = mark.replace(/\/\*[\s\S]*?\*\//g, '');
const constantsCode = constants.replace(/\/\*[\s\S]*?\*\//g, '');
check('the initials helper is gone', !/markInitials/.test(markCode) && !/markInitials/.test(constantsCode));
check('the tone helper is gone', !/markTone/.test(markCode) && !/MARK_TONE_CLASS/.test(constantsCode));
check('the tone type is gone', !/MarkTone/.test(types));
check('the mark takes no seed', !/handle\?:|address\?:/.test(types));
check(
  'the identity block renders it without a seed',
  /<Mark size="lg" \/>/.test(identity),
  'ProfileIdentity still passes a seed'
);
check('and the identity block does not draw letters itself', !/markInitials/.test(identity));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
