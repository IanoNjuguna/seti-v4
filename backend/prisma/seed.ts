import { prisma } from '../src/lib/prisma.js';
import { merchantHandle } from '../src/lib/merchant-name.js';
import { servedNetwork } from '../src/config/networks.js';

/**
 * The demo dataset.
 *
 * Seeded on the network this deployment SERVES (`servedNetwork`), because that
 * is where the app runs: a fresh deployment's demo rows belong on its own
 * network, and seeding them onto the deployment's nominal default would put
 * them somewhere the running server cannot see.
 *
 * The wallet and handle writes are find-then-create rather than `upsert`, and
 * that is deliberate: `Wallet.address` and `Handle.handle` are unique PER NETWORK
 * — partial unique indexes (migration 20261014090000_network_scope) that Prisma
 * cannot express, so it cannot build the `WHERE` clause an `upsert` needs. A
 * global-unique `upsert` on either column no longer compiles, and relying on one
 * is exactly the bug this seed used to carry. The find is scoped by network, the
 * same way `registerWallet` and `claimHandle` scope theirs.
 */
async function main() {
  const network = servedNetwork;

  const user = await prisma.user.upsert({
    where: { email: 'demo@seti.app' },
    update: {},
    create: {
      email: 'demo@seti.app',
      phone: '+254****5678',
      firstName: 'Demo',
      lastName: 'User',
      network,
    },
  });

  const demoAddress = '0x2dea7ad32bab196b7606be88f636093d6b5b1890';
  const existingWallet = await prisma.wallet.findFirst({
    where: { address: demoAddress, network },
  });

  const wallet =
    existingWallet ??
    (await prisma.wallet.create({
      data: {
        userId: user.id,
        chain: 'tempo',
        asset: 'ousd',
        address: demoAddress,
        network,
      },
    }));

  const javaHouseAddress = '0x20C000000000000000000000b9537d11c60E8b50';
  const safaricomAddress = '0x20c0000000000000000000009e8d7eb59b783726';

  const merchant = await prisma.merchant.upsert({
    where: { id: 'merchant_java_house' },
    update: {
      payoutAddress: javaHouseAddress,
    },
    create: {
      id: 'merchant_java_house',
      name: 'Java House',
      category: 'Dining',
      bankCurrency: 'KES',
      payoutAddress: javaHouseAddress,
    },
  });

  const safari = await prisma.merchant.upsert({
    where: { id: 'merchant_safari_com' },
    update: {
      payoutAddress: safaricomAddress,
    },
    create: {
      id: 'merchant_safari_com',
      name: 'Safaricom Shop',
      category: 'Utilities',
      bankCurrency: 'KES',
      payoutAddress: safaricomAddress,
    },
  });

  // The handle is the identity; the Merchant row is the business PROFILE it turns
  // on. Seed both halves of that shape so `seti.live/m/javahouse` resolves.
  await upsertSeededHandle({
    handle: merchantHandle('Java House'),
    name: 'Java House',
    address: javaHouseAddress,
    merchantId: merchant.id,
    network,
  });

  await upsertSeededHandle({
    handle: merchantHandle('Safaricom Shop'),
    name: 'Safaricom Shop',
    address: safaricomAddress,
    merchantId: safari.id,
    network,
  });

  await prisma.transaction.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: user.id,
        walletId: wallet.id,
        network,
        type: 'top_up',
        status: 'completed',
        amount: '15000.00',
        asset: 'ousd',
        fiatAmount: '15000.00',
        fiatCurrency: 'KES',
        counterparty: 'Bridge',
        description: 'Top up via Bank',
        settledAt: new Date(),
      },
      {
        userId: user.id,
        walletId: wallet.id,
        network,
        type: 'payment',
        status: 'completed',
        amount: '250.00',
        asset: 'ousd',
        fiatAmount: '250.00',
        fiatCurrency: 'KES',
        merchantId: merchant.id,
        counterparty: merchant.name,
        description: 'Lunch',
        settledAt: new Date(),
      },
      {
        userId: user.id,
        walletId: wallet.id,
        network,
        type: 'payment',
        status: 'completed',
        amount: '100.00',
        asset: 'ousd',
        fiatAmount: '100.00',
        fiatCurrency: 'KES',
        counterparty: 'Safaricom',
        description: 'Airtime',
        settledAt: new Date(Date.now() - 86400000),
      },
    ],
  });

  console.log('Seeded demo user, wallet, merchant, handles, and transactions.');
}

/** A seeded business handle, kept as one row per network. */
async function upsertSeededHandle(input: {
  handle: string;
  name: string;
  address: string;
  merchantId: string;
  network: string;
}) {
  const existing = await prisma.handle.findFirst({
    where: { handle: input.handle, network: input.network },
  });

  if (existing) {
    await prisma.handle.update({
      where: { id: existing.id },
      data: { merchantId: input.merchantId, name: input.name, address: input.address },
    });
    return;
  }

  await prisma.handle.create({
    data: {
      handle: input.handle,
      network: input.network,
      kind: 'business',
      name: input.name,
      address: input.address,
      merchantId: input.merchantId,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
