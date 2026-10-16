import { prisma } from '../lib/prisma.js';
import { getOnChainBalance, SUPPORTED_ASSETS, PRIMARY_ASSET, type SupportedAsset } from './chain.js';
import { servedNetwork } from '../config/networks.js';
import type { Network } from '../lib/network.js';
import { isValidEvmAddress } from '../lib/address.js';
import type { Hex } from 'viem';

export interface BalanceResult {
  asset: SupportedAsset;
  balance: string;
  currency: string;
}

export async function getUserBalance(
  userId: string,
  asset: SupportedAsset = PRIMARY_ASSET,
  network: Network = servedNetwork
): Promise<BalanceResult> {
  // A wallet row is an ADDRESS, and an address holds every token — so the asset
  // must not filter which row we find. Filtering by it meant a user whose wallet
  // was registered as `ousd` had no balance in `pathusd` at all, because the row
  // simply wasn't found and this returned 0.00. Prefer a row that names the asset
  // (historical rows do), but fall back to any active wallet and read the token
  // at its address.
  //
  // Scoped by NETWORK: a practice balance is not a live balance, and reading the
  // wrong row means reading a balance off the wrong chain.
  const wallet =
    (await prisma.wallet.findFirst({ where: { userId, asset, status: 'active', network } })) ??
    (await prisma.wallet.findFirst({
      where: { userId, status: 'active', network },
      orderBy: { createdAt: 'asc' },
    }));

  if (!wallet) {
    return { asset, balance: '0.00', currency: asset.toUpperCase() };
  }

  if (!isValidEvmAddress(wallet.address)) {
    return { asset, balance: '0.00', currency: asset.toUpperCase() };
  }

  try {
    const balance = await getOnChainBalance(wallet.address as Hex, asset, network);
    return {
      asset,
      balance,
      currency: asset.toUpperCase(),
    };
  } catch (error) {
    console.error('[balance] failed to read on-chain balance', error);
    return { asset, balance: '0.00', currency: asset.toUpperCase() };
  }
}

/**
 * Total balance across supported assets, in KES.
 *
 * The rate is passed in rather than defaulted. A hardcoded rate here meant the
 * home dashboard quoted a different KES figure from the pay screen, which uses
 * the live `getFxQuote()` rate — two numbers for the same balance in one app.
 * Callers should pass the rate from that same quote.
 */
export async function getUserTotalBalanceInFiat(
  userId: string,
  fiatPerUsd: number,
  network: Network = servedNetwork
): Promise<string> {
  const balances = await Promise.all(
    SUPPORTED_ASSETS.map((asset) => getUserBalance(userId, asset, network))
  );

  const totalUsd = balances.reduce((sum, b) => sum + Number(b.balance), 0);
  const totalFiat = totalUsd * fiatPerUsd;

  return totalFiat.toFixed(2);
}
