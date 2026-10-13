/**
 * Wallet registry checks against live Postgres.
 *
 * Run with:  npm run check:wallets
 * Requires:  docker compose up -d (in backend/)
 *
 * Why this exists: `Wallet.address` is globally unique while the app's "already
 * registered" guard was scoped per user, so a deprecated row hid the address from
 * the guard and re-registering it could never succeed — dev login failed with a
 * P2002 every time, and any real rotation back to a prior address would have
 * failed the same way. The scoping is the thing being pinned here, and it only
 * misbehaves against a real unique index, so it cannot be proven with pure
 * functions.
 *
 * IMPORTANT: every row this file touches belongs to a fixture user
 * (`check-wallet-*@seti.test`) with fixture addresses (`0xc0…`, `0xc1…`). It must
 * never read or delete a real user's wallet — a wallet row is where money lands.
 */
import { prisma } from '../lib/prisma.js';
import { registerWallet, resolveWalletAddress } from './wallet-registry.js';

const FIXTURE_EMAIL_A = 'check-wallet-a@seti.test';
const FIXTURE_EMAIL_B = 'check-wallet-b@seti.test';
const ADDR_1 = `0x${'c0'.repeat(20)}`;
const ADDR_2 = `0x${'c1'.repeat(20)}`;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(56)} ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`
  );
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: [FIXTURE_EMAIL_A, FIXTURE_EMAIL_B] } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  if (ids.length > 0) {
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  // Snapshot the real rows so the check can prove it left them alone. A wallet
  // row points at where a customer's money lands; clobbering one is not a test
  // failure, it is a lost payout.
  const realBefore = await prisma.wallet.count({
    where: { user: { email: { notIn: [FIXTURE_EMAIL_A, FIXTURE_EMAIL_B] } } },
  });

  await cleanup();

  const userA = await prisma.user.create({ data: { email: FIXTURE_EMAIL_A } });
  const userB = await prisma.user.create({ data: { email: FIXTURE_EMAIL_B } });

  // --- Fresh registration --------------------------------------------------
  const first = await registerWallet({
    userId: userA.id,
    chain: 'tempo',
    asset: 'ousd',
    address: ADDR_1,
  });
  check('first registration is active', first.status, 'active');
  check('first registration keeps the address', first.address, ADDR_1);

  // --- Idempotent re-registration ------------------------------------------
  const again = await registerWallet({
    userId: userA.id,
    chain: 'tempo',
    asset: 'ousd',
    address: ADDR_1,
  });
  check('re-registering the same address reuses the row', again.id, first.id);
  check('and it is still active', again.status, 'active');
  check(
    'no duplicate row was created',
    await prisma.wallet.count({ where: { userId: userA.id } }),
    1
  );

  // --- THE REGRESSION: a deprecated address for the same owner --------------
  await prisma.wallet.update({ where: { id: first.id }, data: { status: 'deprecated' } });
  const revived = await registerWallet({
    userId: userA.id,
    chain: 'tempo',
    asset: 'ousd',
    address: ADDR_1,
  });
  check('a deprecated address reactivates for its owner', revived.status, 'active');
  check('and it is the same row, not a new one', revived.id, first.id);

  // --- Rotation to a new address -------------------------------------------
  const rotated = await registerWallet({
    userId: userA.id,
    chain: 'tempo',
    asset: 'ousd',
    address: ADDR_2,
  });
  check('rotation creates the new active wallet', rotated.status, 'active');
  const oldRow = await prisma.wallet.findUniqueOrThrow({ where: { id: first.id } });
  check('rotation deprecates the previous address', oldRow.status, 'deprecated');
  check(
    'the user has exactly one active wallet',
    await prisma.wallet.count({ where: { userId: userA.id, status: 'active' } }),
    1
  );

  // --- Another user may not claim a registered address ---------------------
  let refused = false;
  let refusal = '';
  try {
    await registerWallet({
      userId: userB.id,
      chain: 'tempo',
      asset: 'ousd',
      address: ADDR_2,
    });
  } catch (error) {
    refused = true;
    refusal = error instanceof Error ? error.message : String(error);
  }
  check('another user cannot take a registered address', refused, true);
  check('and the refusal names the address', refusal.includes(ADDR_2), true);
  check(
    'the owner keeps their active wallet',
    await prisma.wallet.count({ where: { userId: userA.id, status: 'active' } }),
    1
  );

  // --- Which wallet a login registers --------------------------------------
  //
  // A pure function, but it decides which address the whole app treats as the
  // customer's: the balance read for them, and the wallet a transfer must come
  // from. Registering a different address from the one the browser signs with is
  // exactly how a funded account came to read a balance of zero.
  console.log('\nlogin wallet resolution:');
  const clientWallet = '0x4789025136C3702d95bE4ac2B743f12F7CB6DEC1';
  const signedWallet = '0x02b02edc794548897CD50D9fb55539197efCA1Ac';
  const strangerWallet = '0x1111111111111111111111111111111111111111';

  const bothWallets = {
    walletAddress: clientWallet,
    embeddedWalletAddresses: [signedWallet, clientWallet],
  };

  // Lowercase on the way in: the client sends whatever casing it holds, and the
  // registered row must be the canonical EIP-55 form.
  const declaredOwned = resolveWalletAddress(signedWallet.toLowerCase(), bothWallets);
  check(
    'a declared wallet Privy lists is registered (checksummed)',
    'address' in declaredOwned ? declaredOwned.address : declaredOwned.complaint,
    signedWallet
  );

  const declaredForeign = resolveWalletAddress(strangerWallet, bothWallets);
  check(
    'a declared wallet Privy does NOT list is refused',
    'complaint' in declaredForeign && declaredForeign.complaint.includes('does not belong'),
    true
  );

  const declaredGarbage = resolveWalletAddress('0xnothex', bothWallets);
  check(
    'a malformed declared wallet is refused',
    'complaint' in declaredGarbage && declaredGarbage.complaint.length > 0,
    true
  );

  const undeclared = resolveWalletAddress(undefined, bothWallets);
  check(
    'with nothing declared, Privy primary is used',
    'address' in undeclared ? undeclared.address : undeclared.complaint,
    clientWallet
  );

  const undeclaredListOnly = resolveWalletAddress(undefined, {
    embeddedWalletAddresses: [signedWallet],
  });
  check(
    'with no primary, the first listed wallet is used',
    'address' in undeclaredListOnly ? undeclaredListOnly.address : undeclaredListOnly.complaint,
    signedWallet
  );

  const nothing = resolveWalletAddress(undefined, { embeddedWalletAddresses: [] });
  check(
    'with no wallet anywhere, the login is refused rather than invented',
    'complaint' in nothing && nothing.complaint.includes('No embedded wallet'),
    true
  );

  await cleanup();

  const realAfter = await prisma.wallet.count({
    where: { user: { email: { notIn: [FIXTURE_EMAIL_A, FIXTURE_EMAIL_B] } } },
  });
  check('real wallets were not touched', realAfter, realBefore);

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('wallet registry check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
