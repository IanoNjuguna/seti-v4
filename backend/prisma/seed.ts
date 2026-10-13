import { prisma } from '../src/lib/prisma.js';
import { merchantHandle } from '../src/lib/merchant-name.js';

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@seti.app' },
    update: {},
    create: {
      email: 'demo@seti.app',
      phone: '+254****5678',
      firstName: 'Demo',
      lastName: 'User',
    },
  });

  const wallet = await prisma.wallet.upsert({
    where: { address: '0x2dea7ad32bab196b7606be88f636093d6b5b1890' },
    update: {},
    create: {
      userId: user.id,
      chain: 'tempo',
      asset: 'ousd',
      address: '0x2dea7ad32bab196b7606be88f636093d6b5b1890',
    },
  });

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
  await prisma.handle.upsert({
    where: { handle: merchantHandle('Java House') },
    update: { merchantId: merchant.id },
    create: {
      handle: merchantHandle('Java House'),
      kind: 'business',
      name: 'Java House',
      address: javaHouseAddress,
      merchantId: merchant.id,
    },
  });

  await prisma.handle.upsert({
    where: { handle: merchantHandle('Safaricom Shop') },
    update: { merchantId: safari.id },
    create: {
      handle: merchantHandle('Safaricom Shop'),
      kind: 'business',
      name: 'Safaricom Shop',
      address: safaricomAddress,
      merchantId: safari.id,
    },
  });

  await prisma.transaction.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: user.id,
        walletId: wallet.id,
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
