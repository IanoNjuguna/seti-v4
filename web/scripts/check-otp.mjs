#!/usr/bin/env node
/**
 * `npm run check:otp` — the code screen's behaviour, and the loader it waits with.
 *
 * Two things on this screen are easy to get subtly wrong and impossible to see in a
 * screenshot: how the cells behave when a digit is deleted, and whether the wait is
 * announced to someone who cannot see the animation. Both are asserted here.
 *
 * ## The rules live in `code.logic`, so they are asserted as functions
 *
 * Every case below calls the same pure function the component calls. Nothing in this
 * suite re-implements a rule, so a suite that passes and a field that misbehaves cannot
 * both be true — the field would have to stop using the function, which assertion 17
 * forbids.
 *
 * Run from `web/`: npm run check:otp (part of the root `verify` gate).
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

const logic = await import('../components/signin/otp/code.logic.ts');
const constants = await import('../components/signin/otp/code.constants.ts');
const { toDigits, isComplete, nextCell, fillDigit, deleteAt, moveFocus } = logic;
const { CODE_LENGTH } = constants;

// --- the code, as functions -------------------------------------------------
console.log('\nthe code\n');

check('six digits', CODE_LENGTH === 6, String(CODE_LENGTH));
check('letters and spaces never become digits', toDigits(' 12a3 4b5 ') === '12345', toDigits(' 12a3 4b5 '));
check('a long paste is cut to the code length', toDigits('1234567890') === '123456', toDigits('1234567890'));
check('five digits is not a code', isComplete('12345') === false);
check('six digits is', isComplete('123456') === true);
check('the next cell never points past the last', nextCell('123456') === 5, String(nextCell('123456')));

const typedFirst = fillDigit('', 0, '4');
check('a digit lands where it was typed', typedFirst.code === '4', typedFirst.code);
check('and the caret moves one cell', typedFirst.focus === 1, String(typedFirst.focus));

const typedFifth = fillDigit('4829', 4, '1');
check('typing on moves the prefix on', typedFifth.code === '48291', typedFifth.code);

const corrected = fillDigit('482913', 2, '7');
check('a digit retyped mid-code truncates what followed', corrected.code === '487', corrected.code);
check('and the caret sits after it', corrected.focus === 3, String(corrected.focus));

const pasted = fillDigit('', 0, '482 913');
check('a pasted code replaces the whole field', pasted.code === '482913', pasted.code);
check('and the caret sits in the last cell', pasted.focus === 5, String(pasted.focus));

const cleared = fillDigit('4829', 3, '');
check('clearing a filled cell deletes it', cleared.code === '482', cleared.code);
check('and the caret goes there', cleared.focus === 3, String(cleared.focus));

const backFromEmpty = deleteAt('4829', 4);
check('backspace in an empty cell removes the digit before it', backFromEmpty.code === '482', backFromEmpty.code);
check('and the caret follows it', backFromEmpty.focus === 3, String(backFromEmpty.focus));

check('arrows stop at the first cell', moveFocus(0, -1) === 0);
check('arrows stop at the last cell', moveFocus(5, 1) === 5);

// --- the component that holds them ------------------------------------------
console.log('\nthe cells\n');

const cells = read('components/signin/otp/CodeCells.tsx');
const hook = read('components/signin/otp/useCodeCells.ts');
const panel = read('components/signin/SignInSentPanel.tsx');
const copy = read('components/signin/SignInScreen.constants.ts');

check('one cell per digit, from the one length constant', /length: CODE_LENGTH/.test(cells));
check('the cell component does not re-implement a rule', !/replace\(\/\\D/.test(cells));
check('every cell names its position', /aria-label=\{cellLabel\(index\)\}/.test(cells));
check('a phone opens the numeric keypad', /inputMode="numeric"/.test(cells));
check('the OS may autofill the code', /autoComplete=\{index === nextCell\(code\) \? 'one-time-code' : 'off'\}/.test(cells));
check('the sixth digit submits without a press', /if \(isComplete\(edit\.code\)\) onComplete\(edit\.code\)/.test(hook));
check('backspace is handled by the cells, not the browser', /event\.preventDefault\(\);\s*\n\s*apply\(deleteAt/.test(hook));
check('the code screen holds cells, not one field', /<CodeCells/.test(panel) && !/codeLabel/.test(panel));
check('the address is echoed in full', /SIGN_IN_SENT_COPY\.sentTo/.test(panel) && /text-on-dark"?>\{address\}/.test(panel));
check('the code screen has no heading of its own', !/SIGN_IN_SENT_COPY\.title/.test(panel) && !/<h1/.test(panel));
check('and the address line is what it opens with', /SIGN_IN_SENT_COPY\.sentTo/.test(panel));

// --- the loader -------------------------------------------------------------
console.log('\nthe track\n');

const track = read('components/ui/InfinityTrack.tsx');
const trackConstants = read('components/ui/InfinityTrack.constants.ts');
const globals = read('app/globals.css');
const skeleton = read('components/signin/SignInSkeleton.tsx');
const handoff = read('components/signin/SignInHandoff.tsx');

check('it announces itself as a status', /role="status"/.test(track));
check('with words, not just motion', /sr-only/.test(track) && /label = 'Working…'/.test(track));
check('the keyframes live in the stylesheet, not in the component', !/<style/.test(track) && /@keyframes infinity-track-run/.test(globals));
check('the travelling blocks share one animation', /infinity-track-block/.test(trackConstants) && /\.infinity-track-block \{/.test(globals));
check('the surface is a token, not a passed colour', /bg-canvas-dark|bg-canvas-light|bg-surface-elevated/.test(trackConstants) && !/#[0-9a-fA-F]{3,8}/.test(trackConstants));
check('reduced motion stops the blocks and keeps the path', /prefers-reduced-motion: reduce\)[\s\S]{0,160}\.infinity-track-block \{[\s\S]{0,80}display: none;/.test(globals));
check('the page assembling shows the comet, not the track', /<CometSpinner/.test(skeleton) && !/<InfinityTrack/.test(skeleton));
check('the comet announces itself once', /role="status"/.test(read('components/ui/CometSpinner.tsx')));
check('and the mark is not drawn while the session resolves', /showMark=\{screen\.stage !== 'restoring'\}/.test(read('components/signin/SignInScreen.tsx')));
check('the front door is one column, centred', /items-center justify-center/.test(read('components/signin/SignInPanel.tsx')) && !/grid-cols-2/.test(read('components/signin/SignInPanel.tsx')));
check('with the page grain, and no decorative panel', /grain-layer/.test(read('components/signin/SignInPanel.tsx')) && !/SignInAmbientPanel/.test(read('components/signin/SignInPanel.tsx')));
check('the document keeps a name without a visible heading', /<h1 className="sr-only">/.test(read('components/signin/SignInPanel.tsx')));
check('and the footnote the consent already states is gone', !/footnote/.test(copy));
check('and so does the handoff into the app', /<InfinityTrack/.test(handoff));
check('the handoff no longer pulses a bar', !/animate-pulse/.test(handoff));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
