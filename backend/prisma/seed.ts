import { prisma } from '../src/lib/prisma.js';
import { merchantHandle } from '../src/lib/merchant-name.js';

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@seti.app' },
    update: {},
    create: {
      email: 'demo@seti.app',
      phone: '+254712345678',
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

  const merchant = await prisma.merchant.upsert({
    where: { id: 'merchant_java_house' },
    update: {
      payoutAddress: '0x20C000000000000000000000b9537d11c60E8b50',
      handle: merchantHandle('Java House'),
    },
    create: {
      id: 'merchant_java_house',
      name: 'Java House',
      category: 'Dining',
      bankCurrency: 'KES',
      handle: merchantHandle('Java House'),
      payoutAddress: '0x20C000000000000000000000b9537d11c60E8b50',
    },
  });

  await prisma.merchant.upsert({
    where: { id: 'merchant_safari_com' },
    update: {
      payoutAddress: '0x20c0000000000000000000009e8d7eb59b783726',
      handle: merchantHandle('Safaricom Shop'),
    },
    create: {
      id: 'merchant_safari_com',
      name: 'Safaricom Shop',
      category: 'Utilities',
      bankCurrency: 'KES',
      handle: merchantHandle('Safaricom Shop'),
      payoutAddress: '0x20c0000000000000000000009e8d7eb59b783726',
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

  console.log('Seeded demo user, wallet, merchant, and transactions.');
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
