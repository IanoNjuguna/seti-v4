/**
 * A person's DISPLAY NAME — what the profile screen writes, and what it may not touch.
 *
 * Run with:  npm run check:profile-name
 * Requires:  nothing. No database, no network, no wallet: the rule is pure and the wiring is
 *            read from source.
 *
 * ## Why this suite exists (#536)
 *
 * The profile screen showed the name an account goes by as a fact nobody could change: the
 * only writer was the deprecated dev-only `POST /auth/register`. Adding a real one means adding
 * the one place a customer can put arbitrary text into a column that is printed in headings, in
 * rows, and on receipts — so the boundaries are asserted rather than trusted to review:
 *
 *   1. the cleaning rule (whitespace, a leading `@`, length, control characters);
 *   2. that the route is behind the auth hook and answers the caller's own account;
 *   3. that the write touches the NAME and clears the split columns, and cannot reach the
 *      handle, which is signed and immutable;
 *   4. that the change leaves an audit row.
 *
 * The handle's own immutability is asserted where it belongs (`check:username`,
 * `handle-rename.check.ts`). This file only proves the new write path does not become a second
 * way to rename one.
 */
import { readFileSync } from 'node:fs';
import { normalizePersonName, PERSON_NAME_MAX } from '../lib/person-name.js';

let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

console.log('the name is cleaned, not stored as typed:\n');

check('inner runs of whitespace collapse to one space', normalizePersonName('Ian   Mwangi') === 'Ian Mwangi');
check('the edges are trimmed', normalizePersonName('  Ian Mwangi  ') === 'Ian Mwangi');
check(
  'a leading @ is dropped, because the field sits above the handle',
  normalizePersonName('@ian.mwangi') === 'ian.mwangi',
  String(normalizePersonName('@ian.mwangi'))
);
check(
  'a pasted name with a line break becomes one line',
  normalizePersonName('Ian\nMwangi') === 'Ian Mwangi',
  String(normalizePersonName('Ian\nMwangi'))
);

console.log('\nand refused when there is no name in it:\n');

check('empty is refused', normalizePersonName('') === null);
check('whitespace only is refused', normalizePersonName('   ') === null);
check('a single character is refused', normalizePersonName('i') === null);
check('a lone @ is refused', normalizePersonName('@') === null);
check(
  `exactly ${PERSON_NAME_MAX} characters is accepted`,
  normalizePersonName('x'.repeat(PERSON_NAME_MAX)) === 'x'.repeat(PERSON_NAME_MAX)
);
check(
  `${PERSON_NAME_MAX + 1} characters is refused`,
  normalizePersonName('x'.repeat(PERSON_NAME_MAX + 1)) === null
);
check(
  'a control character is refused, because it breaks every row it prints in',
  normalizePersonName('Ian\u0007Mwangi') === null
);

/*
 * The wiring, read from source. A rule that is right and unused is the shape of the bug this
 * whole file exists for, so the route, the write and the audit row are asserted where they are.
 */
const routes = readFileSync('src/routes/account.ts', 'utf8');
const service = readFileSync('src/services/account.ts', 'utf8');
const audit = readFileSync('src/services/audit.ts', 'utf8');

console.log('\nand the profile write is wired to it:\n');

check("the route is POST /name on the account router", /app\.post\('\/name'/.test(routes));
check('it validates with the shared rule', /normalizePersonName\(body\.name\)/.test(routes));
check('and writes through the service', /setAccountName\(/.test(routes));
check(
  'it sits behind the auth hook, like the rest of this router',
  /app\.addHook\('preHandler', authMiddleware\)/.test(routes)
);
check(
  'an invalid name is a coded 400, not a 500',
  /code: 'invalid-name'/.test(routes) && /status\(400\)/.test(routes)
);

check(
  'the write sets the name and clears the split columns',
  /data: \{ firstName: input\.name, lastName: null \}/.test(service)
);
check(
  'and cannot reach the handle',
  !/handle/i.test(service.slice(service.indexOf('export async function setAccountName')))
);
check('the change leaves an audit row', /'profile\.name\.updated'/.test(service));
check('which is a registered audit action', /'profile\.name\.updated'/.test(audit));

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
