/**
 * `npm run check:activity-labels`: every ledger type can be named, labelled and directed.
 *
 * Run with:  npm run check:activity-labels     (appended to `npm run verify`)
 *
 * Requires:  nothing. This suite reads `prisma/schema.prisma` and calls two pure
 *            functions, so it runs before any database exists.
 *
 * WHY THIS EXISTS
 *
 * A savings deposit reached Activity titled `Unknown`, wearing an `S` and rendered as an
 * outflow of the amount a WITHDRAWAL would have brought back (#415). Every cause was one
 * hole: `enum TransactionType` grew two members for the vault and the tables that turn a
 * row into words (`transaction-view.ts`) did not grow with it. Nothing failed, because the
 * fallback is a word — `Unknown` — that looks like a sentence rather than like a missing
 * branch, so the defect shipped and was found by a customer reading their own money.
 *
 * The schema is where the vocabulary is declared, so the schema is what this suite reads:
 * a type added there without a title, without a label, or with the wrong direction fails
 * here, in the same run that would otherwise have shipped it.
 *
 * WHAT IS ASSERTED
 *
 *  1. The enum is read from the schema, so the list is the database's and not a copy that
 *     can drift.
 *  2. Every member has a TITLE. `describeCounterparty` is the real function, called with the
 *     row shape savings rows actually have (`counterparty: null`), and it may never answer
 *     `Unknown` nor echo the ledger's own word back at the customer.
 *  3. Every member has a LABEL. `describeType` feeds the row's category, and a raw
 *     `savings_deposit` is the database's vocabulary on a customer's screen.
 *  4. The direction. Money arriving is a fact about the type, and the two the vault adds are
 *     opposite: a deposit leaves the spendable balance, a withdrawal comes back to it.
 *  5. The vault's two types are named for what they are and are not confusable: a deposit reads as a
 *     savings deposit, a withdrawal as a savings withdrawal, and neither as the other.
 *
 * WHAT IT DELIBERATELY DOES NOT ASSERT: the glyph. That table is the client's
 * (`web/components/ui/transaction-glyph.ts`) and `check:transaction-glyph` holds it to the
 * same enum. Two suites, each reading the language it governs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeCounterparty, describeType, directionOf } from './transaction-view.js';

/** `backend/`, from `backend/src/services/`. */
const BACKEND = join(__dirname, '..', '..');

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/**
 * The members of a Prisma enum, from the schema itself.
 *
 * Doc comments (`///`) are stripped because they are prose, and a blank line inside the
 * block is not a member. Nothing else in the block is load-bearing yet.
 */
function enumMembers(source: string, name: string): string[] {
  const block = new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`).exec(source)?.[1];
  if (!block) return [];

  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('///') && !line.startsWith('//'))
    .map((line) => line.split(/\s+/)[0]);
}

/** A row as a savings row is actually written: no counterparty, no description. */
function namelessRow(type: string) {
  return { type, counterparty: null, description: null };
}

function main(): void {
  const schema = readFileSync(join(BACKEND, 'prisma', 'schema.prisma'), 'utf8');
  const types = enumMembers(schema, 'TransactionType');

  console.log('the schema declares the vocabulary, and this suite reads it:');
  check('the enum is found and is not empty', types.length > 0, String(types.length));
  check(
    'the two types the vault added are in it',
    types.includes('savings_deposit') && types.includes('savings_withdrawal'),
    types.join(', ')
  );

  console.log('\nevery type can be named:');
  for (const type of types) {
    const title = describeCounterparty(namelessRow(type));
    check(`${type} has a title`, title !== 'Unknown' && title !== '', title);
    check(
      `${type} does not echo the ledger's word back`,
      title !== type,
      title
    );
  }

  console.log('\nevery type can be labelled where a category is printed:');
  for (const type of types) {
    const label = describeType(type);
    check(`${type} has a label`, label !== type && label !== '', label);
  }

  console.log('\nevery type knows which way the money went:');
  for (const type of types) {
    const expected = ['top_up', 'p2p_receive', 'savings_withdrawal'].includes(type)
      ? 'in'
      : 'out';
    check(`${type} is money ${expected}`, directionOf(type) === expected, directionOf(type));
  }

  console.log('\nand the vault is named as what it is, not as where it went:');
  {
    const deposit = describeCounterparty(namelessRow('savings_deposit'));
    const withdrawal = describeCounterparty(namelessRow('savings_withdrawal'));

    check('a deposit reads as a savings deposit', deposit === 'Savings deposit', deposit);
    check(
      'a withdrawal reads as a savings withdrawal',
      withdrawal === 'Savings withdrawal',
      withdrawal
    );
    check(
      'and the two are not confused for one another',
      deposit !== withdrawal,
      `${deposit} / ${withdrawal}`
    );
  }

  console.log('\n' + '-'.repeat(74));
  console.log(
    failures === 0 ? `All ${total} checks passed.` : `${failures} of ${total} checks FAILED.`
  );
  if (failures > 0) process.exit(1);
}

main();
