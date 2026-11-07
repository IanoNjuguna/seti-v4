/**
 * `npm run check:transaction-glyph` — which mark a row wears (#409).
 *
 * The circle is the first thing read on a row, so its rules are cheap to state and easy to break by
 * accident: a merchant keeps its initial, an unnamed transfer takes its type's glyph, money arriving is
 * the only thing tinted, and a row that has not happened wears the state rather than the type.
 */
import { readFileSync } from 'node:fs';
import { ANONYMOUS_TITLES, GLYPH_BY_TYPE, initialOf, rowGlyph } from '../components/ui/transaction-glyph.ts';

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

const row = (overrides) => ({
  id: 't',
  merchant: 'Sent',
  category: 'Transfer',
  amount: -10,
  currency: 'KES',
  direction: 'out',
  date: new Date('2026-11-05T09:00:00Z'),
  status: 'completed',
  ...overrides,
});

console.log('a row wears what happened:');
{
  check('a send is an arrow out', rowGlyph(row({ type: 'p2p_send' })).icon === 'send');
  check('a receive is the mirror', rowGlyph(row({ type: 'p2p_receive', direction: 'in' })).icon === 'arrowDownLeft');
  check('a deposit is a plus', rowGlyph(row({ type: 'top_up', direction: 'in' })).icon === 'add');
  check('a swap is the exchange mark', rowGlyph(row({ type: 'convert' })).icon === 'swap');
  // No fee mark: the 2% never becomes a row, so it falls back to the direction (#411).
  check('a fee, if one ever appeared, would still read as money leaving', rowGlyph(row({ type: 'fee' })).icon === 'send');
  check('a withdrawal is money leaving', rowGlyph(row({ type: 'withdrawal' })).icon === 'send');
}

console.log('and a name keeps its letter:');
{
  check(
    'a named merchant draws its initial, not a glyph',
    rowGlyph(row({ type: 'payment', merchant: 'Java House' })).icon === null
  );
  check(
    'a payment to a wallet we cannot name does not',
    rowGlyph(row({ type: 'payment', merchant: 'Payment' })).icon === 'send'
  );
  check(
    'a send to a person stays anonymous even though it is titled Sent',
    rowGlyph(row({ type: 'p2p_send', merchant: 'Sent' })).icon === 'send'
  );
  // A claimed username is a name, so the row keeps its initial (#411).
  check(
    'a send to a claimed username keeps that name\'s initial',
    rowGlyph(row({ type: 'p2p_send', merchant: '@akinyi' })).icon === null
  );
  check('and the initial ignores the at sign', initialOf('@akinyi') === 'A', initialOf('@akinyi'));
  check('a merchant keeps its first letter', initialOf('Java House') === 'J', initialOf('Java House'));
  check('an empty name still draws something', initialOf('') === '?');
}

console.log('tint is for money arriving:');
{
  check('received money is tinted', rowGlyph(row({ type: 'p2p_receive', direction: 'in' })).tone === 'in');
  check('a deposit is tinted', rowGlyph(row({ type: 'top_up', direction: 'in' })).tone === 'in');
  check('a send is not', rowGlyph(row({ type: 'p2p_send' })).tone === 'quiet');
  check('a named merchant is not', rowGlyph(row({ type: 'payment', merchant: 'Naivas' })).tone === 'quiet');
  check('nor is a swap', rowGlyph(row({ type: 'convert' })).tone === 'quiet');
}

console.log('a row that has not happened wears its state:');
{
  check('pending is a clock', rowGlyph(row({ type: 'p2p_send', status: 'pending' })).icon === 'clock');
  check('failed is an alert', rowGlyph(row({ type: 'p2p_send', status: 'failed' })).icon === 'alert');
  check(
    'a failed merchant payment is an alert, not its initial',
    rowGlyph(row({ type: 'payment', merchant: 'Java House', status: 'failed' })).icon === 'alert'
  );
  check(
    'and neither carries a tint',
    rowGlyph(row({ type: 'p2p_receive', direction: 'in', status: 'pending' })).tone === 'quiet'
  );
}

console.log('a row with no ledger type falls back to the direction:');
{
  check('in is the mirror', rowGlyph(row({ type: undefined, direction: 'in' })).icon === 'arrowDownLeft');
  check('out is the arrow out', rowGlyph(row({ type: undefined })).icon === 'send');
}

console.log('\nevery ledger type has a mark and a title (#415):');
{
  /*
   * The enum is read from the schema, so this section cannot drift from the database. It exists
   * because a type was added for the vault and the glyph table was not: the row fell back to a
   * letter (`S`, for a title the table also did not know) and the money it described was titled
   * `Unknown`. A table that answers by falling back cannot report its own hole, so the hole is
   * reported here, against the vocabulary that declared it.
   */
  const schema = readFileSync(new URL('../../backend/prisma/schema.prisma', import.meta.url), 'utf8');
  const block = /enum TransactionType \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? '';
  const types = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('///') && !line.startsWith('//'))
    .map((line) => line.split(/\s+/)[0]);

  check('the schema declares the ledger types', types.length > 0, String(types.length));

  /*
   * One documented exception (#411): a `fee` row is a shape the schema allows and nothing writes,
   * because the 2% rides inside the payment's own transfer. Its absence is asserted rather than
   * assumed, so a glyph for a mark nothing wears is also a failure.
   */
  const NO_GLYPH_BY_DESIGN = new Set(['fee']);

  for (const type of types) {
    if (NO_GLYPH_BY_DESIGN.has(type)) {
      check(`${type} wears no glyph, by design (#411)`, GLYPH_BY_TYPE[type] === undefined);
      continue;
    }

    check(`${type} has a glyph of its own`, GLYPH_BY_TYPE[type] !== undefined, String(GLYPH_BY_TYPE[type]));
    /*
     * A type whose mark is missing does not fail visibly: `rowGlyph` falls back to the direction,
     * so `savings_withdrawal` would wear "money leaving" while the money comes back. This asserts
     * the mark the row actually wears is the table's.
     */
    check(
      `${type} wears that glyph, not the direction's fallback`,
      rowGlyph(row({ type })).icon === GLYPH_BY_TYPE[type]
    );
  }

  // Every title the server can put on a nameless row must be one this list knows, or the circle
  // draws a letter where it should draw a mark. Read from the server's own tables rather than
  // listed here, because a copy is what drifted the first time.
  const view = readFileSync(
    new URL('../../backend/src/services/transaction-view.ts', import.meta.url),
    'utf8'
  );
  const titles = [
    ...new Set(
      [...view.matchAll(/^\s{2}[a-z0-9_]+:\s*'([^']+)',\s*$/gm)].map((match) => match[1])
    ),
  ];

  check('the server names titles this suite can read', titles.length >= 9, String(titles.length));

  for (const title of titles) {
    check(`\`${title}\` counts as a title, not a name`, ANONYMOUS_TITLES.has(title));
  }
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
