import { prisma } from '../src/lib/prisma.js';

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
    where: { address: '0xDemoWalletAddress' },
    update: {},
    create: {
      userId: user.id,
      chain: 'tempo',
      asset: 'ousd',
      address: '0xDemoWalletAddress',
    },
  });

  const merchant = await prisma.merchant.upsert({
    where: { id: 'merchant_java_house' },
    update: {},
    create: {
      id: 'merchant_java_house',
      name: 'Java House',
      category: 'Dining',
      bankCurrency: 'KES',
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
