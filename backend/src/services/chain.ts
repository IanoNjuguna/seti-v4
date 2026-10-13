import { createPublicClient, http, erc20Abi, formatUnits, type Hex } from 'viem';
import { network, SUPPORTED_ASSETS } from '../config/networks.js';
import type { SupportedAsset } from '../config/networks.js';

export { network, SUPPORTED_ASSETS };
export { formatUnits };
export type { SupportedAsset };

/**
 * Minimal viem chain definition for Tempo.
 */
export const tempoChain = {
  id: network.chainId,
  name: network.displayName,
  nativeCurrency: {
    name: 'Tempo',
    symbol: 'TEMPO',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [network.rpcUrl] },
    public: { http: [network.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Tempo Explorer', url: network.explorerUrl },
  },
} as const;

const publicClient = createPublicClient({
  chain: tempoChain,
  transport: http(),
});

export { publicClient };

const assetToContract: Record<SupportedAsset, Hex> = Object.fromEntries(
  SUPPORTED_ASSETS.map((asset) => [asset, network.tokens[asset]])
) as Record<SupportedAsset, Hex>;

export const assetDecimals: Record<SupportedAsset, number> = Object.fromEntries(
  SUPPORTED_ASSETS.map((asset) => [asset, 6])
) as Record<SupportedAsset, number>;

export async function getOnChainBalance(
  address: Hex,
  asset: SupportedAsset = 'ousd'
): Promise<string> {
  const contract = assetToContract[asset];
  const rawBalance = await publicClient.readContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  });

  return formatUnits(rawBalance, assetDecimals[asset]);
}

export async function getTransactionReceipt(txHash: Hex) {
  return publicClient.getTransactionReceipt({ hash: txHash });
}

/**
 * Where Tempo pays the gas fee when the fee token is not the native one.
 *
 * A transaction that spends a TIP-20 stablecoin as its fee token pays for gas by
 * sending that token to this address, so gas appears in the receipt as an ordinary
 * Transfer. A receipt that did not know this would list the customer's gas payment
 * as a payment to somebody — the same class of mistake as reading `MAX_FEE` as a
 * charge. A protocol address, not a fixture.
 */
export const FEE_AMM_ADDRESS = '0xfeec000000000000000000000000000000000000' as Hex;

export async function getBlockTimestamp(blockNumber: bigint): Promise<Date> {
  const block = await publicClient.getBlock({ blockNumber });
  return new Date(Number(block.timestamp) * 1000);
}

/**
 * Which of our assets a token address is, or null if it is neither.
 *
 * Case-insensitive because the address in a log is whatever the contract emitted,
 * while our config stores its own casing — an exact-match lookup would silently
 * fail to recognise our own token.
 */
export function assetForContract(address: string): SupportedAsset | null {
  const lowered = address.toLowerCase();
  for (const asset of SUPPORTED_ASSETS) {
    if (assetToContract[asset].toLowerCase() === lowered) return asset;
  }
  return null;
}

export async function waitForTransactionReceipt(
  txHash: Hex,
  timeout = 30_000,
  pollingInterval = 2_000
) {
  return publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout,
    pollingInterval,
  });
}

export function getTokenContract(asset: SupportedAsset): Hex {
  return assetToContract[asset];
}

export async function getBlockNumber(): Promise<bigint> {
  return publicClient.getBlockNumber();
}

export async function estimateErc20TransferGas(
  from: Hex,
  to: Hex,
  amount: bigint,
  asset: SupportedAsset = 'ousd'
): Promise<bigint> {
  const contract = assetToContract[asset];
  return publicClient.estimateContractGas({
    address: contract,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, amount],
    account: from,
  });
}

/**
 * Gas used by a real two-call Tempo batch, measured from an on-chain receipt.
 *
 * `npm run prove:batch` signs one and prints the hash; this number is that
 * transaction's `gasUsed` (298,172). It is a MEASUREMENT, not a model — the
 * point of quoting it here is that the customer-facing gas figure is a real cost
 * times a live price, rather than a fudge factor.
 *
 * It is also the pessimistic end: a batch whose fee token needs converting
 * through the Fee AMM (which is what Tempo does when the customer's token is not
 * the validator's preference) costs this much, while a plain transfer estimates
 * at ~38k gas. Quoting the expensive case is the right direction for a number
 * that decides whether a send can afford to happen.
 *
 * Re-measure it with `npm run prove:batch` if Tempo changes its pricing; the
 * calibration assertion in `send.check.ts` fails if the assumed
 * 18-decimal-gas → 6-decimal-token conversion stops holding.
 */
const MEASURED_BATCH_GAS = BigInt(298_172);

/** Gas rounding: wei (18dp) to the token's own units (6dp) for a $1 stablecoin. */
const GAS_WEI_PER_TOKEN_UNIT = BigInt(10 ** 12);

export interface NetworkFeeEstimate {
  /** The fee in the asset's own units, as a decimal string. */
  feeAsset: string;
  /** Where the figure came from, so a UI can be honest about it. */
  source: 'estimate' | 'reserve';
}

/**
 * What a batch's gas costs right now, in the asset being sent.
 *
 * The live gas price times the measured gas of a real batch. Falls back to
 * `source: 'reserve'` when the RPC cannot answer: a payment preview must not fail
 * because a fee estimate did, and the caller already reserves a conservative
 * figure for the balance check.
 */
export async function estimateNetworkFee(asset: SupportedAsset): Promise<NetworkFeeEstimate> {
  try {
    const gasPrice = await publicClient.getGasPrice();
    const feeWei = MEASURED_BATCH_GAS * gasPrice;

    return {
      feeAsset: formatUnits(feeWei / GAS_WEI_PER_TOKEN_UNIT, assetDecimals[asset]),
      source: 'estimate',
    };
  } catch {
    return { feeAsset: '0', source: 'reserve' };
  }
}
