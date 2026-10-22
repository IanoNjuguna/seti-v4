/**
 * `npm run check:choice-row` — the second-factor options cannot regress into buttons.
 *
 * The bug this pins (#172) was not a typo. Two options with a label and a detail line were
 * rendered inside `Button`, whose every variant is a fixed 48px with centred content, so
 * the text was taller than its box: on a phone the next option's border was drawn through
 * the first option's detail, and on desktop the two options read as two centred calls to
 * action instead of a list.
 *
 * Pixels are not asserted here, because a source check cannot see them. What it can see is
 * the pair of decisions that produced the bug and that a future edit would silently undo:
 *
 *   1. the row is not a Button, and its recipe lets the box grow with its words and keeps
 *      them on the left;
 *   2. the section states the heading once, so the panel is told it is embedded.
 *
 * Run from `web/`: npm run check:choice-row (part of the root `verify` gate).
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

const choice = read('components/mfa/MfaEnrolChoice.tsx');
const recipe = read('components/ui/ChoiceRow.constants.ts');
const panel = read('components/mfa/MfaEnrolPanel.tsx');
const panelTypes = read('components/mfa/MfaEnrolPanel.types.ts');
const screen = read('components/profile/security/SecurityScreen.tsx');

// 1. The options are rows, not buttons.
check('the options use ChoiceRow', choice.includes("from '@/components/ui/ChoiceRow'"));
check(
  'the options do not use Button',
  !/from '@\/components\/ui['"]/.test(choice.replace("'@/components/ui/ChoiceRow'", '')) &&
    !/<Button[\s>]/.test(choice),
  'Button reappeared in MfaEnrolChoice'
);
check('there are two options', (choice.match(/<ChoiceRow/g) ?? []).length === 2);

// 2. The recipe is a row: no fixed height, no centring, left-aligned text.
const className = recipe.slice(recipe.indexOf('CHOICE_ROW_CLASS'));
check('the recipe keeps its words on the left', className.includes('text-left'));
check('the recipe has no fixed height', !/(?<!min-)h-\d/.test(className), 'a fixed height is back');
check('the recipe centres nothing', !className.includes('justify-center'));
check('the recipe still clears 44px', /min-h-1[4-9]|min-h-\[/.test(className));

// 3. The heading is stated once.
check('the panel can be told it is embedded', panelTypes.includes('embedded?: boolean'));
check('the panel drops its header when embedded', panel.includes('embedded ? null :'));
check('the security screen passes it', /MfaEnrolPanel[\s\S]{0,200}?\bembedded\b/.test(screen));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
