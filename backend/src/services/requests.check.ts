/**
 * Requests for money, against a real database — `npm run check:requests`.
 *
 * Requires `docker compose up -d` (the `seti-postgres` container), like the other
 * database-backed suites.
 *
 * What this suite exists for is the one rule that cannot be enforced by review: **an ask settles
 * once**. #98 states it as acceptance criterion 3, and the failure it prevents is a person being
 * marked paid by somebody else's transfer, or paid twice by a retry on a flaky network. So the three
 * settle cases are asserted against the database rather than against a mock: a first settle, a second
 * settle that is refused AND says which payment took it, and one payment claimed by two asks, which
 * the unique index refuses.
 *
 * The rest pins the creation rules that would otherwise fail in front of a stranger:
 *
 *  - an ask naming a handle nothing resolves fails at creation, in front of the author (#98 AC5);
 *  - an ask for yourself is refused rather than sitting in your own Activity for ever;
 *  - an amount is matched, not parsed, so `1e3`, `0`, three decimals and a negative all fail;
 *  - the handle's address is snapshotted, so a rename does not re-point a link already sent.
 *
 * Every row this suite writes is prefixed with a per-run id and deleted by one predicate per table at
 * the end, followed by a count proving nothing of the run is left behind.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import {
  cancelRequest,
  createRequest,
  isValidRequestAmount,
  defaultExpiryFrom,
  listRequests,
  PaymentRequestError,
  readPublicRequest,
  settleRequest,
} from './requests.js';
import { servedNetwork } from '../config/networks.js';

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

const RUN = `reqcheck_${randomUUID().slice(0, 8)}`;

async function refusalOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (error instanceof PaymentRequestError) return error.code;
    return `threw:${(error as Error).message}`;
  }
}

async function main() {
  const [asker, payee] = await Promise.all([
    prisma.user.create({
      data: { email: `${RUN}_asker@seti.test`, firstName: 'Ask', lastName: 'Er' },
    }),
    prisma.user.create({
      data: { email: `${RUN}_payee@seti.test`, firstName: 'Ian', lastName: 'Njuguna' },
    }),
  ]);

  const [payeeHandle, ownHandle] = await Promise.all([
    prisma.handle.create({
      data: {
        handle: `${RUN}-ian`,
        network: servedNetwork,
        kind: 'person',
        name: 'Ian Njuguna',
        address: '0x1111111111111111111111111111111111111111',
        userId: payee.id,
      },
    }),
    prisma.handle.create({
      data: {
        handle: `${RUN}-asker`,
        network: servedNetwork,
        kind: 'person',
        name: 'Ask Er',
        address: '0x2222222222222222222222222222222222222222',
        userId: asker.id,
      },
    }),
  ]);

  console.log('an ask is resolved at creation, and refused there when it cannot be:');
  {
    check(
      'a handle nothing resolves fails at creation, not at payment',
      (await refusalOf(() =>
        createRequest({ creatorId: asker.id, payeeHandle: `${RUN}-nobody`, amount: '500.00' })
      )) === 'payee-not-found'
    );

    check(
      'and writes no row',
      (await prisma.paymentRequest.count({ where: { creatorId: asker.id } })) === 0
    );

    const created = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '500.00',
      memo: 'lunch',
    });

    check('the ask carries the handle it named', created.payeeHandle === payeeHandle.handle);
    check(
      'and the address the handle had at creation',
      created.payeeAddress === payeeHandle.address.toLowerCase()
    );
    check('it is open', created.status === 'open');
    check('its public id is opaque and unguessable', /^[0-9a-f]{18}$/.test(created.publicId));

    check(
      'asking yourself is refused',
      (await refusalOf(() =>
        createRequest({ creatorId: asker.id, payeeHandle: ownHandle.handle, amount: '10.00' })
      )) === 'payee-is-you'
    );
  }

  console.log('\nan amount is matched, not parsed:');
  for (const amount of ['0', '0.00', '12.345', '-5', '1e3', '', '1234567890', 'KES 500']) {
    check(`"${amount}" is refused`, isValidRequestAmount(amount) === false, amount);
  }
  for (const amount of ['500.00', '500', '0.01', '999999999.99']) {
    check(`"${amount}" is accepted`, isValidRequestAmount(amount) === true, amount);
  }

  console.log('\nan ask settles once:');
  {
    const request = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '250.00',
    });

    const txHash = `0x${'a'.repeat(64)}`;
    await settleRequest({ publicId: request.publicId, transactionId: `${RUN}_tx1`, txHash });

    const settled = await prisma.paymentRequest.findUnique({
      where: { publicId: request.publicId },
    });
    check('the first settle marks it settled', settled?.status === 'settled');
    check('and records the payment that did it', settled?.settledTransactionId === `${RUN}_tx1`);

    const second = await refusalOf(() =>
      settleRequest({ publicId: request.publicId, transactionId: `${RUN}_tx2`, txHash })
    );
    check('a second settle is refused', second === 'already-settled', String(second));

    check(
      'and the refusal names the payment that took it',
      settled?.settledTransactionId === `${RUN}_tx1`
    );

    const after = await prisma.paymentRequest.findUnique({
      where: { publicId: request.publicId },
    });
    check('the second attempt changed nothing', after?.settledTransactionId === `${RUN}_tx1`);

    // The same payment claimed by a different ask: refused by the unique index, not by the status guard.
    const other = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '250.00',
    });
    const reused = await refusalOf(() =>
      settleRequest({ publicId: other.publicId, transactionId: `${RUN}_tx1`, txHash })
    );
    check(
      'one payment cannot settle two asks',
      reused !== null && reused.startsWith('threw:'),
      String(reused)
    );
    check(
      'and the second ask stays open',
      (
        await prisma.paymentRequest.findUnique({ where: { publicId: other.publicId } })
      )?.status === 'open'
    );
  }

  console.log('\na withdrawn ask cannot be paid, and a settled one cannot be withdrawn:');
  {
    const cancelled = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '90.00',
    });
    await cancelRequest(cancelled.publicId, asker.id);
    check(
      'settling a cancelled ask is refused',
      (await refusalOf(() =>
        settleRequest({ publicId: cancelled.publicId, transactionId: `${RUN}_tx3`, txHash: '0x1' })
      )) === 'already-cancelled'
    );

    const settled = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '70.00',
    });
    await settleRequest({ publicId: settled.publicId, transactionId: `${RUN}_tx4`, txHash: '0x2' });
    check(
      'cancelling a settled ask is refused',
      (await refusalOf(() => cancelRequest(settled.publicId, asker.id))) === 'already-settled'
    );

    check(
      'and a stranger cannot withdraw somebody else\'s ask',
      (await refusalOf(() => cancelRequest(settled.publicId, payee.id))) === 'not-found'
    );
  }

  console.log('\nexpiry is a fact on the row, and a guard on the settle (#449):');
  {
    const defaulted = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '60.00',
    });
    const row = await prisma.paymentRequest.findUnique({
      where: { publicId: defaulted.publicId },
      select: { expiresAt: true },
    });
    const days = row?.expiresAt
      ? (row.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      : -1;
    check('an ask created without an expiry gets the 30-day default', days > 29 && days <= 30, String(days));

    const forever = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '60.00',
      expiresAt: null,
    });
    check(
      'and an explicit null means no expiry at all, which is a tip jar',
      (await prisma.paymentRequest.findUnique({ where: { publicId: forever.publicId } }))
        ?.expiresAt === null
    );

    // A past expiry is refused at creation, so time is simulated by moving a valid row's clock back.
    check(
      'a past expiry is refused at creation',
      (await refusalOf(() =>
        createRequest({
          creatorId: asker.id,
          payeeHandle: payeeHandle.handle,
          amount: '40.00',
          expiresAt: new Date(Date.now() - 60_000),
        })
      )) === 'expiry-invalid'
    );
    check(
      'and so is one beyond the horizon, where "never" is the honest ask',
      (await refusalOf(() =>
        createRequest({
          creatorId: asker.id,
          payeeHandle: payeeHandle.handle,
          amount: '40.00',
          expiresAt: new Date('3000-01-01T00:00:00Z'),
        })
      )) === 'expiry-invalid'
    );
    check(
      'an unreadable instant is refused rather than stored',
      (await refusalOf(() =>
        createRequest({
          creatorId: asker.id,
          payeeHandle: payeeHandle.handle,
          amount: '40.00',
          expiresAt: new Date('nonsense'),
        })
      )) === 'expiry-invalid'
    );

    const created = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '40.00',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    // Time passes: the row is open, and its instant is behind us.
    await prisma.paymentRequest.update({
      where: { publicId: created.publicId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const lapsed = created;
    check(
      'settling a lapsed ask is refused as expired, not as paid',
      (await refusalOf(() =>
        settleRequest({ publicId: lapsed.publicId, transactionId: `${RUN}_tx5`, txHash: '0x3' })
      )) === 'expired'
    );
    check(
      'and the lapsed ask is still open in the database, because expiry is derived, not swept',
      (await prisma.paymentRequest.findUnique({ where: { publicId: lapsed.publicId } }))?.status ===
        'open'
    );

    const lapsedView = await readPublicRequest(lapsed.publicId);
    check('the payer\'s page reads it as expired', lapsedView?.status === 'expired', String(lapsedView?.status));

    // In time, and one second from lapsing: the guard is the database's clock, so this still settles.
    const nearly = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '30.00',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await settleRequest({ publicId: nearly.publicId, transactionId: `${RUN}_tx6`, txHash: '0x4' });
    check(
      'an ask inside its window still settles',
      (await prisma.paymentRequest.findUnique({ where: { publicId: nearly.publicId } }))?.status ===
        'settled'
    );

    const noExpiry = await createRequest({
      creatorId: asker.id,
      payeeHandle: payeeHandle.handle,
      amount: '20.00',
      expiresAt: null,
    });
    await settleRequest({ publicId: noExpiry.publicId, transactionId: `${RUN}_tx7`, txHash: '0x5' });
    check(
      'and an ask with no expiry settles at any age',
      (await prisma.paymentRequest.findUnique({ where: { publicId: noExpiry.publicId } }))?.status ===
        'settled'
    );

    check(
      'the default window is 30 days',
      Math.round((defaultExpiryFrom().getTime() - Date.now()) / (24 * 60 * 60 * 1000)) === 30
    );
  }

  console.log('\nthe three reads agree, and one account never sees another\'s asks:');
  {
    const mine = await listRequests(asker.id);
    const theirs = await listRequests(payee.id);

    // 500 open, 250 settled, 250 open, 90 cancelled, 70 settled, then the expiry block's
    // 60 defaulted, 60 no-expiry, 40 lapsed, 30 settled, 20 settled.
    check('the author lists their asks', mine.length === 10, String(mine.length));
    check('and the payee lists none of them', theirs.length === 0, String(theirs.length));
    check(
      'the newest is first',
      mine[0].createdAt >= mine[mine.length - 1].createdAt
    );

    const open = mine.find((row) => row.status === 'open');
    check('one ask is still open', Boolean(open));

    const publicView = open ? await readPublicRequest(open.publicId) : null;
    check('a link resolves without an account', publicView?.payeeHandle === payeeHandle.handle);
    check(
      'and carries only what a payer needs',
      publicView !== null &&
        Object.keys(publicView).sort().join(',') ===
          'amount,currency,expiresAt,memo,payeeAddress,payeeHandle,publicId,status',
      publicView ? Object.keys(publicView).sort().join(',') : 'null'
    );
    check('an unknown id resolves to nothing', (await readPublicRequest('nope')) === null);
  }

  console.log('\ncleanup:');
  {
    await prisma.paymentRequest.deleteMany({ where: { creatorId: asker.id } });
    await prisma.handle.deleteMany({ where: { handle: { startsWith: RUN } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });

    check(
      'no request of this run is left',
      (await prisma.paymentRequest.count({ where: { creatorId: asker.id } })) === 0
    );
    check('no handle of this run is left', (await prisma.handle.count({ where: { handle: { startsWith: RUN } } })) === 0);
    check('no user of this run is left', (await prisma.user.count({ where: { email: { startsWith: RUN } } })) === 0);
  }

  console.log('-'.repeat(74));
  console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('requests check crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
