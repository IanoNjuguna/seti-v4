/**
 * `npm run check:profile-mark` — the account's mark is derived, stable, and not a Gravatar.
 *
 * A mark looks like decoration and is not: it is the one thing on a profile that is stable
 * across sessions, and the only reason two accounts with the same initials look different.
 * Two properties have to hold or it is worse than no mark:
 *
 *   1. **Stable.** The same account always draws the same mark, on every render and every
 *      device. A hash that drifts means a person's identity changes colour while they look
 *      at it.
 *   2. **Local.** No request, no third party. A Gravatar URL is the md5 of an email address,
 *      so serving one would leak an email-derived identifier on every profile view and give
 *      anyone with a handle an email-enumeration oracle. Our own CSP is `img-src 'self'`,
 *      which would block it regardless.
 *
 * Run from `web/`: npm run check:profile-mark (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { markInitials, markTone } from '../components/ui/Mark.tsx';
import { MARK_TONES } from '../components/ui/Mark.constants.ts';

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

// --- the letters -----------------------------------------------------------
console.log('the letters\n');
check('a single name gives two letters', markInitials('javahouse') === 'JA', String(markInitials('javahouse')));
check('a hyphenated name gives one per part', markInitials('ian-njuguna') === 'IN', String(markInitials('ian-njuguna')));
check('a spaced name gives one per part', markInitials('ian njuguna') === 'IN', String(markInitials('ian njuguna')));
check('an at-sign is not a letter', markInitials('@seti') === 'SE', String(markInitials('@seti')));
check('no name gives no letters', markInitials(null) === null);
check('an empty name gives no letters', markInitials('   ') === null);

// --- the tone --------------------------------------------------------------
console.log('\nthe tone\n');
const A = '0x1111111111111111111111111111111111111111';
check('the same name always gives the same tone', markTone('javahouse') === markTone('javahouse'));
check('an at-sign does not change the tone', markTone('@javahouse') === markTone('javahouse'));
check('case does not change the tone', markTone('JavaHouse') === markTone('javahouse'));
check('the tone is one of the declared five', MARK_TONES.includes(markTone('javahouse')));
check('an account with no name still has a tone', MARK_TONES.includes(markTone(A)));

// Twenty addresses must not all land on one tone, or the tone distinguishes nothing.
const tones = new Set();
for (let i = 0; i < 20; i += 1) {
  tones.add(markTone(`name-${i}`));
}
check('twenty names spread across more than one tone', tones.size > 1, `${tones.size} tone(s)`);

// --- it is local -----------------------------------------------------------
console.log('\nno third party\n');
const mark = read('components/ui/Mark.tsx');
check('the mark makes no request', !/https?:\/\//.test(mark) && !/\bfetch\(/.test(mark));
check('gravatar is not mentioned as a source', !/gravatar\.com/i.test(mark.replace(/Gravatar URL is the md5/g, '')));

const identity = read('components/profile/ProfileIdentity.tsx');
check('the identity block renders the mark', /<Mark\b/.test(identity));
check('the identity block no longer draws a single initial', !/\binitial\b/.test(identity));

// The name is what generates the mark, so the component must seed from it first.
check('the mark is generated from the name', /markTone\(handle \?\? address\)/.test(mark));

// An unnamed account shows the product's face, in the neutral well: the cream mark on a
// coloured circle is the pair BrandMark's own rule forbids.
check('an unnamed account falls back to the brand mark', /<BrandMark\b/.test(mark));
check('the fallback is the friendly face', /expression="friendly"/.test(mark));
check('the fallback uses the light canvas', /canvas="light"/.test(mark));
check('the fallback is not drawn on a tone', /MARK_FALLBACK_CLASS/.test(mark) && !/MARK_TONE_CLASS\[markToneFor\(address, handle\)\]\s*>\s*<BrandMark/.test(mark));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
