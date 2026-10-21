/**
 * `npm run check:payee` — the name a ledger row keeps about who was paid.
 *
 * Two pure functions and the boundary between them: a caller may declare a name and
 * the row keeps it only when it IS a name, and a reader gets `null` rather than an
 * exception from every shape `metadata` can arrive in. The second half is what the
 * Activity list depends on: it renders rows written before this existed.
 */
import { asHandle, payeeHandleOf } from './payee.js';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

console.log('what a declared name is stored as:');
check('a plain handle is kept', asHandle('akinyi') === 'akinyi');
check('case is normalised, because the namespace is lowercased', asHandle('Akinyi') === 'akinyi');
check('a dot is part of a handle, not punctuation', asHandle('co.op') === 'co.op');
check('surrounding space is trimmed', asHandle('  akinyi  ') === 'akinyi');
check('63 characters is the ceiling', asHandle('a'.repeat(63)) === 'a'.repeat(63));
check('64 is refused rather than truncated', asHandle('a'.repeat(64)) === null);

console.log('what is refused — the row simply has no name:');
check('prose with a space', asHandle('Akinyi Wanjiru') === null);
check('an address is not a handle', asHandle('0x4c2b8e9d1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b0c') === null);
check('an empty string', asHandle('') === null);
check('whitespace only', asHandle('   ') === null);
check('a leading dot', asHandle('.akinyi') === null);
check('a number is not a name', asHandle(42) === null);
check('nothing at all', asHandle(null) === null && asHandle(undefined) === null);

console.log('reading it back off a row:');
check('the stored shape', payeeHandleOf({ payee: { handle: 'akinyi' } }) === 'akinyi');
check('beside committed keys', payeeHandleOf({ client: {}, feeRoutingMode: 'batch', payee: { handle: 'akinyi' } }) === 'akinyi');
check(
  'a caller cannot smuggle one in under `client`',
  payeeHandleOf({ client: { payee: { handle: 'akinyi' } } }) === null
);
check('no metadata at all (rows written before this existed)', payeeHandleOf(null) === null);
check('a missing key', payeeHandleOf({}) === null);
check('a payee that is a bare string, not an object', payeeHandleOf({ payee: 'akinyi' }) === null);
check('a handle that is not a string', payeeHandleOf({ payee: { handle: 7 } }) === null);
check('junk where metadata should be', payeeHandleOf('not json') === null && payeeHandleOf(12) === null);
check('an array', payeeHandleOf(['payee']) === null);

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
