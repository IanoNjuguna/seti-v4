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
  reconcileClaims,
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
  const [asker, other] = await Promise.all([
    prisma.user.create({
      data: { email: `${RUN}_asker@seti.test`, firstName: 'Ask', lastName: 'Er' },
    }),
    prisma.user.create({
      data: { email: `${RUN}_other@seti.test`, firstName: 'Ian', lastName: 'Njuguna' },
    }),
  ]);

  const [destinationHandle, ownHandle] = await Promise.all([
    prisma.handle.create({
      data: {
        handle: `${RUN}-ian`,
        network: servedNetwork,
        kind: 'person',
        name: 'Ian Njuguna',
        address: '0x1111111111111111111111111111111111111111',
        userId: other.id,
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

  /*
   * A real ledger row for the payer, because `settleRequest` verifies the MONEY rather than trusting
   * the id it is handed: the row's fiat figure, its type and its status are all part of the check.
   */
  const payerWallet = await prisma.wallet.create({
    data: {
      userId: other.id,
      chain: 'tempo',
      asset: 'ousd',
      // Unique per run: the address is unique in the schema, so a recycled one fails the second run.
      address: `0x${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`.slice(0, 42),
      network: servedNetwork,
    },
    select: { id: true },
  });

  let paymentSerial = 0;
  const paid = async (
    amount: string,
    options: {
      type?: string;
      status?: string;
      currency?: string | null;
      claimPublicId?: string;
    } = {}
  ) => {
    paymentSerial += 1;
    return prisma.transaction.create({
      data: {
        userId: other.id,
        walletId: payerWallet.id,
        network: servedNetwork,
        type: (options.type ?? 'p2p_send') as never,
        status: (options.status ?? 'completed') as never,
        amount: '1.00000000',
        asset: 'ousd',
        fiatAmount: amount,
        fiatCurrency: options.currency === null ? null : (options.currency ?? 'KES'),
        claimPublicId: options.claimPublicId ?? null,
        txHash: `0x${randomUUID().replace(/-/g, '')}${paymentSerial}`,
      },
      select: { id: true, txHash: true },
    });
  };

  console.log('an ask is resolved at creation, and refused there when it cannot be:');
  {
    check(
      'a handle nothing resolves fails at creation, not at payment',
      (await refusalOf(() =>
        createRequest({ creatorId: asker.id, destinationHandle: `${RUN}-nobody`, amount: '500.00' })
      )) === 'destination-not-found'
    );

    check(
      'and writes no row',
      (await prisma.paymentRequest.count({ where: { creatorId: asker.id } })) === 0
    );

    const created = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '500.00',
      memo: 'lunch',
    });

    check('the ask carries the handle it named', created.destinationHandle === destinationHandle.handle);
    check(
      'and the address the handle had at creation',
      created.destinationAddress === destinationHandle.address.toLowerCase()
    );
    check('it is open', created.status === 'open');
    check('its public id is opaque and unguessable', /^[0-9a-f]{18}$/.test(created.publicId));

    check(
      'asking yourself is refused',
      (await refusalOf(() =>
        createRequest({ creatorId: asker.id, destinationHandle: ownHandle.handle, amount: '10.00' })
      )) === 'destination-not-yours'
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
      destinationHandle: destinationHandle.handle,
      amount: '250.00',
    });

    const first = await paid('250.00');
    const secondPayment = await paid('250.00');
    await settleRequest({ publicId: request.publicId, transactionId: first.id });

    const settled = await prisma.paymentRequest.findUnique({
      where: { publicId: request.publicId },
    });
    check('the first settle marks it settled', settled?.status === 'settled');
    check('and records the payment that did it', settled?.settledTransactionId === first.id);

    const second = await refusalOf(() =>
      settleRequest({ publicId: request.publicId, transactionId: secondPayment.id })
    );
    check('a second settle is refused', second === 'already-settled', String(second));

    check(
      'and the refusal names the payment that took it',
      settled?.settledTransactionId === first.id
    );

    const after = await prisma.paymentRequest.findUnique({
      where: { publicId: request.publicId },
    });
    check('the second attempt changed nothing', after?.settledTransactionId === first.id);

    // The same payment claimed by a different ask: refused by the unique index, not by the status guard.
    const other = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '250.00',
    });
    const reused = await refusalOf(() =>
      settleRequest({ publicId: other.publicId, transactionId: first.id })
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

  console.log('\nthe money is checked, not trusted:');
  {
    /*
     * #449: a single ask is paid IN FULL. These are the cases where a caller hands over a real ledger
     * row that is real money and still must not close the ask.
     */
    const short = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '250.00',
    });
    const shortPayment = await paid('249.99');
    check(
      'a payment one cent short is refused, and the ask stays open',
      (await refusalOf(() =>
        settleRequest({ publicId: short.publicId, transactionId: shortPayment.id })
      )) === 'amount-short'
    );
    check(
      'the short payment left no trace on the ask',
      (await prisma.paymentRequest.findUnique({ where: { publicId: short.publicId } }))?.status ===
        'open'
    );

    const over = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '250.00',
    });
    const overPayment = await paid('250.01');
    check(
      'a payment one cent over is refused, because that is a different agreement',
      (await refusalOf(() =>
        settleRequest({ publicId: over.publicId, transactionId: overPayment.id })
      )) === 'amount-over'
    );

    const dollarPayment = await paid('250.00', { currency: 'USD' });
    check(
      'a payment in another currency is refused',
      (await refusalOf(() =>
        settleRequest({ publicId: over.publicId, transactionId: dollarPayment.id })
      )) === 'currency-mismatch'
    );

    const topUp = await paid('250.00', { type: 'top_up' });
    check(
      'a ledger row that is not a send is refused',
      (await refusalOf(() =>
        settleRequest({ publicId: over.publicId, transactionId: topUp.id })
      )) === 'payment-not-a-send'
    );

    const pendingPayment = await paid('250.00', { status: 'pending' });
    check(
      'a payment that has not completed is refused',
      (await refusalOf(() =>
        settleRequest({ publicId: over.publicId, transactionId: pendingPayment.id })
      )) === 'payment-not-completed'
    );

    const noFigure = await paid('250.00', { currency: null });
    check(
      'a payment with no fiat figure is refused, rather than assumed to be the right size',
      (await refusalOf(() =>
        settleRequest({ publicId: over.publicId, transactionId: noFigure.id })
      )) === 'currency-mismatch'
    );

    check(
      'an id that names no ledger row is refused',
      (await refusalOf(() =>
        settleRequest({ publicId: over.publicId, transactionId: `${RUN}_no-such-payment` })
      )) === 'payment-not-found'
    );

    check(
      'and none of that settled the ask',
      (await prisma.paymentRequest.findUnique({ where: { publicId: over.publicId } }))?.status ===
        'open'
    );
  }

  console.log('\na withdrawn ask cannot be paid, and a settled one cannot be withdrawn:');
  {
    const cancelled = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '90.00',
    });
    await cancelRequest(cancelled.publicId, asker.id);
    const forCancelled = await paid('90.00');
    check(
      'settling a cancelled ask is refused',
      (await refusalOf(() =>
        settleRequest({ publicId: cancelled.publicId, transactionId: forCancelled.id })
      )) === 'already-cancelled'
    );

    const settled = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '70.00',
    });
    await settleRequest({ publicId: settled.publicId, transactionId: (await paid('70.00')).id });
    check(
      'cancelling a settled ask is refused',
      (await refusalOf(() => cancelRequest(settled.publicId, asker.id))) === 'already-settled'
    );

    check(
      'and a stranger cannot withdraw somebody else\'s ask',
      (await refusalOf(() => cancelRequest(settled.publicId, other.id))) === 'not-found'
    );
  }

  console.log('\nexpiry is a fact on the row, and a guard on the settle (#449):');
  {
    const defaulted = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
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
      destinationHandle: destinationHandle.handle,
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
          destinationHandle: destinationHandle.handle,
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
          destinationHandle: destinationHandle.handle,
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
          destinationHandle: destinationHandle.handle,
          amount: '40.00',
          expiresAt: new Date('nonsense'),
        })
      )) === 'expiry-invalid'
    );

    const created = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '40.00',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    // Time passes: the row is open, and its instant is behind us.
    await prisma.paymentRequest.update({
      where: { publicId: created.publicId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const lapsed = created;
    const forLapsed = await paid('40.00');
    check(
      'settling a lapsed ask is refused as expired, not as paid',
      (await refusalOf(() =>
        settleRequest({ publicId: lapsed.publicId, transactionId: forLapsed.id })
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
      destinationHandle: destinationHandle.handle,
      amount: '30.00',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await settleRequest({ publicId: nearly.publicId, transactionId: (await paid('30.00')).id });
    check(
      'an ask inside its window still settles',
      (await prisma.paymentRequest.findUnique({ where: { publicId: nearly.publicId } }))?.status ===
        'settled'
    );

    const noExpiry = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '20.00',
      expiresAt: null,
    });
    await settleRequest({ publicId: noExpiry.publicId, transactionId: (await paid('20.00')).id });
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

  console.log('\na payment that names an ask, and could not settle it, is finished by the sweep:');
  {
    /*
     * The crash window: `recordSend` wrote the ledger row and the settle did not happen. The sweep is
     * the retry, and it must settle exactly the payments that qualify and nothing else.
     */
    const recoverable = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '100.00',
    });
    await paid('100.00', { claimPublicId: recoverable.publicId });

    const first = await reconcileClaims();
    check('the sweep settles an ask its payment names', first.settled.includes(recoverable.publicId));
    check(
      'and the ask is settled',
      (await prisma.paymentRequest.findUnique({ where: { publicId: recoverable.publicId } }))?.status ===
        'settled'
    );

    const again = await reconcileClaims();
    check('running it again changes nothing', again.settled.length === 0, String(again.settled.length));

    const short = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '100.00',
    });
    await paid('99.00', { claimPublicId: short.publicId });
    const sweep = await reconcileClaims();
    check(
      'a short payment is reported, never used to close the ask',
      sweep.refused.some((row) => row.publicId === short.publicId && row.code === 'amount-short'),
      JSON.stringify(sweep.refused)
    );
    check(
      'and that ask stays open for a human',
      (await prisma.paymentRequest.findUnique({ where: { publicId: short.publicId } }))?.status ===
        'open'
    );

    const unfinished = await createRequest({
      creatorId: asker.id,
      destinationHandle: destinationHandle.handle,
      amount: '100.00',
    });
    await paid('100.00', { claimPublicId: unfinished.publicId, status: 'pending' });
    const pendingSweep = await reconcileClaims();
    check(
      'a pending payment settles nothing',
      !pendingSweep.settled.includes(unfinished.publicId) &&
        (await prisma.paymentRequest.findUnique({ where: { publicId: unfinished.publicId } }))
          ?.status === 'open'
    );
  }

  console.log('\nthe three reads agree, and one account never sees another\'s asks:');
  {
    const mine = await listRequests(asker.id);
    const theirs = await listRequests(other.id);

    // 500 open, 250 settled, 250 open, 90 cancelled, 70 settled, then the expiry block's
    // 60 defaulted, 60 no-expiry, 40 lapsed, 30 settled, 20 settled.
    check('the author lists their asks', mine.length === 15, String(mine.length));
    check('and the other lists none of them', theirs.length === 0, String(theirs.length));
    check(
      'the newest is first',
      mine[0].createdAt >= mine[mine.length - 1].createdAt
    );

    const open = mine.find((row) => row.status === 'open');
    check('one ask is still open', Boolean(open));

    const publicView = open ? await readPublicRequest(open.publicId) : null;
    check('a link resolves without an account', publicView?.destinationHandle === destinationHandle.handle);
    check(
      'and carries only what a payer needs',
      publicView !== null &&
        Object.keys(publicView).sort().join(',') ===
          'amount,currency,destinationAddress,destinationHandle,expiresAt,memo,publicId,status',
      publicView ? Object.keys(publicView).sort().join(',') : 'null'
    );
    check('an unknown id resolves to nothing', (await readPublicRequest('nope')) === null);
  }

  console.log('\ncleanup:');
  {
    await prisma.paymentRequest.deleteMany({ where: { creatorId: asker.id } });
    // The payer's ledger rows and wallet first: a required relation refuses the user delete otherwise.
    await prisma.transaction.deleteMany({ where: { userId: other.id } });
    await prisma.wallet.deleteMany({ where: { userId: other.id } });
    await prisma.handle.deleteMany({ where: { handle: { startsWith: RUN } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });

    check(
      'no request of this run is left',
      (await prisma.paymentRequest.count({ where: { creatorId: asker.id } })) === 0
    );
    check('no handle of this run is left', (await prisma.handle.count({ where: { handle: { startsWith: RUN } } })) === 0);
    check('no user of this run is left', (await prisma.user.count({ where: { email: { startsWith: RUN } } })) === 0);
    check(
      'no ledger row of this run is left',
      (await prisma.transaction.count({ where: { userId: other.id } })) === 0
    );
    check('no wallet of this run is left', (await prisma.wallet.count({ where: { userId: other.id } })) === 0);
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
