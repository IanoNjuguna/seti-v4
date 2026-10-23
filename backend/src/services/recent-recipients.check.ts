/**
 * `npm run check:recent-recipients`: who the send screen may offer to pay again (#99).
 *
 * Two pure things and the filter between them: the derivation, which turns a page of
 * the account's own outbound rows into at most five people, and the WHERE clause,
 * which is what scopes those rows to the caller and their network. A screenshot can
 * show a list; it cannot show that a pending transfer is not in it, that a name is
 * never invented, or that the query cannot reach somebody else's history.
 */
import {
  RECENT_RECIPIENT_LIMIT,
  recentRecipientWhere,
  recentRecipients,
  type RecipientRow,
} from './recent-recipients.js';

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

const AKINYI = '0x4c2b8e9d1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b0c';
const JAVA = '0x9f2c4b7e5d1a0c3f8b62d4e7a91c5b8d0f3e6a41';

/** A ledger row as the derivation sees it. */
function row(overrides: Partial<RecipientRow> = {}): RecipientRow {
  return {
    type: 'p2p_send',
    status: 'completed',
    counterparty: AKINYI,
    createdAt: new Date('2026-10-20T09:00:00+03:00'),
    metadata: { payee: { handle: 'akinyi' } },
    merchant: null,
    ...overrides,
  };
}

console.log('the filter, which is what scopes the list:');
{
  const where = recentRecipientWhere('user-1', 'mainnet');

  check('scoped to the caller', where.userId === 'user-1');
  check('scoped to the caller’s network', where.network === 'mainnet');
  check(
    'only the two outbound counterparty types',
    where.type.in.length === 2 && where.type.in.includes('p2p_send') && where.type.in.includes('payment'),
    where.type.in.join(',')
  );
  check(
    'a pending or processing send is never offered',
    !where.status.in.includes('pending') && !where.status.in.includes('processing'),
    where.status.in.join(',')
  );
  check('a completed send is', where.status.in.includes('completed'));
  check('a failed one is too: the person is still somebody they pay', where.status.in.includes('failed'));
  check('money coming IN is not a payee', !where.type.in.includes('p2p_receive'));
  check('a top-up is not a payee', !where.type.in.includes('top_up'));
}

console.log('a person with history gets an entry point:');
{
  const [person] = recentRecipients([row()]);

  check('there is one', Boolean(person));
  check('named as the handle it was paid as', person?.name === 'akinyi', String(person?.name));
  check('which is also the target to re-resolve', person?.handle === 'akinyi');
  check('with the address behind it', person?.address === AKINYI);
  check('and when they were last paid', person?.lastPaidAt === '2026-10-20T06:00:00.000Z', String(person?.lastPaidAt));
}

console.log('an account with no history gets none:');
{
  check('no rows, no people', recentRecipients([]).length === 0);
  check(
    'a row that is not a send is not a person',
    recentRecipients([row({ type: 'top_up', counterparty: null })]).length === 0
  );
  check(
    'a pending send is not a person yet',
    recentRecipients([row({ status: 'processing' })]).length === 0
  );
  check(
    'nor is a reversed one: the money came back',
    recentRecipients([row({ status: 'reversed' })]).length === 0
  );
}

console.log('most recent first, one row per person:');
{
  const people = recentRecipients([
    row({ createdAt: new Date('2026-10-22T09:00:00+03:00') }),
    row({ createdAt: new Date('2026-10-20T09:00:00+03:00') }),
    row({ counterparty: JAVA, metadata: { payee: { handle: 'javahouse' } }, createdAt: new Date('2026-10-19T09:00:00+03:00') }),
  ]);

  check('two people behind three payments', people.length === 2, `${people.length}`);
  check('the newest of them first', people[0]?.name === 'akinyi');
  check('the second is the other person', people[1]?.name === 'javahouse');
  check(
    'the repeated person keeps the NEWEST payment’s date',
    people[0]?.lastPaidAt === '2026-10-22T06:00:00.000Z',
    String(people[0]?.lastPaidAt)
  );
  check(
    'the same address paid by name and by address is one person',
    recentRecipients([
      row({ metadata: { payee: { handle: 'akinyi' } } }),
      row({ metadata: null, createdAt: new Date('2026-10-01T09:00:00+03:00') }),
    ]).length === 1
  );
}

console.log('five at most:');
{
  /** Nine distinct addresses, none of them the zero address (which is a mint). */
  const many = Array.from({ length: 9 }, (_, index) =>
    row({
      counterparty: `0x${String(index + 1).repeat(40)}`,
      metadata: { payee: { handle: `person${index}` } },
      createdAt: new Date(2026, 9, 20 - index),
    })
  );
  const people = recentRecipients(many);

  check('the list is capped', people.length === RECENT_RECIPIENT_LIMIT, `${people.length}`);
  check('and it is the newest that are kept', people[0]?.name === 'person0' && people[4]?.name === 'person4');
  check('the five oldest are the ones dropped', !people.some((person) => person.name === 'person8'));
}

console.log('a merchant payment names the merchant’s own business:');
{
  const [shop] = recentRecipients([
    row({
      type: 'payment',
      counterparty: null,
      metadata: null,
      merchant: { name: 'Java House', payoutAddress: JAVA, handleEntry: { handle: 'javahouse' } },
    }),
  ]);

  check('the signed business name', shop?.name === 'Java House', String(shop?.name));
  check('and the handle to re-resolve', shop?.handle === 'javahouse');
  check('paid to its payout address', shop?.address === JAVA);
}

console.log('a name is never invented:');
{
  const [shop] = recentRecipients([
    row({
      type: 'payment',
      counterparty: null,
      metadata: null,
      merchant: { name: 'Java House', payoutAddress: JAVA, handleEntry: null },
    }),
  ]);

  check('a business with no handle keeps its name, with no target of its own', shop?.handle === null);
  check('and the address is the fallback target', shop?.address === JAVA);

  const [anonymous] = recentRecipients([row({ metadata: null })]);
  check('an address-only send is named by its address', anonymous?.name === '0x4c2b…9b0c', String(anonymous?.name));
  check('not by a sentence about itself', !String(anonymous?.name).includes('Sent to'), String(anonymous?.name));
  check('and it has no handle, so it targets the address', anonymous?.handle === null);

  const [prose] = recentRecipients([row({ metadata: { payee: { handle: 'Akinyi Wanjiru' } } })]);
  check('prose where a handle should be is dropped, not shown as a name', prose?.name === '0x4c2b…9b0c', String(prose?.name));
}

console.log('rows that cannot be paid are not offered:');
{
  check(
    'a counterparty that is not an address',
    recentRecipients([row({ counterparty: '+254700000000', metadata: null })]).length === 0
  );
  check(
    'the zero address, which is a mint, not a person',
    recentRecipients([row({ counterparty: `0x${'0'.repeat(40)}`, metadata: null })]).length === 0
  );
  check(
    'a merchant with no payout address either',
    recentRecipients([
      row({ type: 'payment', counterparty: null, merchant: { name: 'Java House', payoutAddress: null } }),
    ]).length === 0
  );
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
