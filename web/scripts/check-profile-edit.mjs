#!/usr/bin/env node
/**
 * `npm run check:profile-name` — the personal-information screen exists, and its one write is
 * the only write (#536).
 *
 * ## Why this exists
 *
 * The profile page showed the name an account goes by as a fact nobody could change; the only
 * writer was the deprecated dev-only `POST /auth/register`. Adding a real one adds a screen that
 * must not quietly become two screens: the Seti name is signed, it is what people pay by, and it
 * is immutable. A row that looks tappable, or a sentence that promises a change, is the whole
 * bug back in a different shape.
 *
 * Importing the REAL copy and reading the REAL source, in the style of `check:save-copy`: the
 * sentences and the wiring are asserted where they live, not in a fixture that can drift.
 *
 * Run from `web/` with tsx.
 */
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(path, import.meta.url));

const { PERSONAL_COPY } = await import(
  '../components/profile/personal/PersonalDetails.constants.ts'
);

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

console.log('settings leads to the screen, as a row that navigates:');
{
  const settings = read('../components/profile/ProfileSettings.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
  check('the personal row links to the screen', settings.includes('href="/app/profile/personal"'));
  check('and it still carries the name and the handle', /value=\{name\}/.test(settings) && /handle/.test(settings));
  check('the screen exists', exists('../app/(product)/app/profile/personal/page.tsx'));
}

console.log('\nand the screen lists four facts, one of them writable:');
{
  const screen = read('../components/profile/personal/PersonalDetailsScreen.tsx').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  );
  check('the name row opens the form', screen.includes('<PersonalNameForm'));
  check('the name row has an edit control', screen.includes('details.beginEdit'));
  check('email and phone are shown', screen.includes('PERSONAL_COPY.emailLabel') && screen.includes('PERSONAL_COPY.phoneLabel'));
}

console.log('\nthe Seti name is immutable, and says so instead of hiding it:');
{
  const screen = read('../components/profile/personal/PersonalDetailsScreen.tsx').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  );
  const handleRow = screen.slice(screen.indexOf('PERSONAL_COPY.handleLabel'), screen.indexOf('PERSONAL_COPY.emailLabel'));
  check('the handle row is a statement, not a destination', !/href/.test(handleRow), handleRow.slice(0, 80));
  check('it prints the handle as a value', /@\$\{details\.handle\}/.test(handleRow));
  check(
    'and the sentence says it cannot be changed',
    /cannot be changed/.test(PERSONAL_COPY.handleNote),
    PERSONAL_COPY.handleNote
  );
  check(
    'no edit affordance is offered for it',
    !/editHandle|cancelHandle|beginEditHandle/.test(screen)
  );
}

console.log('\nthe name write goes through one endpoint, and repaints the session:');
{
  const api = read('../lib/api/account.ts');
  const hook = read('../components/profile/personal/usePersonalDetails.ts').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  );
  check('the client posts to /account/name', /post<AccountNameUpdate>\('\/account\/name'/.test(api));
  check('the hook uses that client', hook.includes('updateAccountName('));
  check('and refreshes the session before it says saved', /refreshUser\(\)/.test(hook));
  check(
    'the session exposes refreshUser',
    read('../lib/auth/auth.types.ts').includes('refreshUser: () => Promise<void>') &&
      read('../lib/auth/SessionProvider.tsx').includes('const refreshUser = useCallback')
  );
  check(
    'an empty name is refused before a request is made',
    hook.includes('PERSONAL_COPY.nameRequired')
  );
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
