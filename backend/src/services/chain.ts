import { createPublicClient, http, erc20Abi, formatUnits, type Hex } from 'viem';
import { network, SUPPORTED_ASSETS, PRIMARY_ASSET } from '../config/networks.js';
import type { SupportedAsset } from '../config/networks.js';

export { network, SUPPORTED_ASSETS, PRIMARY_ASSET };
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
  asset: SupportedAsset = PRIMARY_ASSET
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
  asset: SupportedAsset = PRIMARY_ASSET
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
 * Gas used by a real two-call Tempo batch, measured from an on-chain receipt,
 * PER ASSET — because the fee token is what decides the cost.
 *
 * A Tempo transaction pays its gas by converting the fee token through the Fee
 * AMM (`0xfeec…0000`). When the fee token is the one the validators prefer — the
 * `feeToken`-left-unset proof below — there is no conversion; when it is any
 * other token the AMM route is taken and the batch costs materially more. Seti
 * signs with `feeToken` set to the asset it is spending, so the number that
 * matters is that asset's own measurement, not a single shared constant.
 *
 *   pathusd  298,172 — `npm run prove:batch`, tx
 *            0x913060ec28c168c38494bd5b725dea2778f93d34275c766447be2c45c68a9dcf
 *            (block 39296367). The no-conversion case: the cheap end.
 *   ousd     790,472 — the batched OUSD receipt
 *            0x8e9c2ba14b14e046bdec1974eb119c4b7137a437ddd538d22038303c5b4aa78d
 *            (block 39315983). The fee token routes through the Fee AMM, so it
 *            costs ~2.6× the pathUSD proof — which is why the single constant
 *            that used to live here under-quoted the moment the app signed OUSD.
 *
 * Both are MEASUREMENTS of real receipts, not models. The OUSD figure is the
 * pessimistic end of the observed range: a fresh OUSD batch re-measured at block
 * 39401713 used 543,172, so 790,472 is the worst case seen, and quoting the
 * expensive case is the right direction for a number that decides whether a send
 * can afford to happen.
 *
 * Re-measure with `npm run prove:batch -- --asset=<asset>` if Tempo changes its
 * pricing; the calibration assertion in `send.check.ts` fails if the assumed
 * 18-decimal-gas → 6-decimal-token conversion stops holding.
 */
const MEASURED_BATCH_GAS: Record<SupportedAsset, bigint> = {
  pathusd: BigInt(298_172),
  ousd: BigInt(790_472),
};

/** Gas rounding: wei (18dp) to the token's own units (6dp) for a $1 stablecoin. */
const GAS_WEI_PER_TOKEN_UNIT = BigInt(10 ** 12);

/**
 * The gas price the BALANCE RESERVATION assumes, in wei.
 *
 * Deliberately far above the live price (~0.6 gwei on Moderato), so a spike on a
 * busy block cannot leave a send short — the reservation is what keeps a payment
 * from reverting at signing time. It is a PRICE assumption, not a second gas
 * figure: the gas half of the reservation is the SAME `MEASURED_BATCH_GAS`
 * measurement the displayed estimate reads, so the two move together when the
 * measurement is re-taken. Picked so the OUSD reservation lands at ~0.0103 OUSD,
 * just above the flat 0.01 floor it replaces.
 */
const RESERVE_GAS_PRICE_WEI = BigInt(13_000_000_000);

export interface NetworkFeeEstimate {
  /** The fee in the asset's own units, as a decimal string. */
  feeAsset: string;
  /** Where the figure came from, so a UI can be honest about it. */
  source: 'estimate' | 'reserve';
}

/**
 * What a batch's gas costs right now, in the asset being sent.
 *
 * The live gas price times the measured gas of a real batch for THIS asset.
 * Falls back to `reserveNetworkFee` when the RPC cannot answer: a payment preview
 * must not fail because a fee estimate did.
 */
export async function estimateNetworkFee(asset: SupportedAsset): Promise<NetworkFeeEstimate> {
  try {
    const gasPrice = await publicClient.getGasPrice();
    const feeWei = MEASURED_BATCH_GAS[asset] * gasPrice;

    return {
      feeAsset: formatUnits(feeWei / GAS_WEI_PER_TOKEN_UNIT, assetDecimals[asset]),
      source: 'estimate',
    };
  } catch {
    return reserveNetworkFee(asset);
  }
}

/**
 * The BALANCE RESERVATION for a batch's gas, in the asset's own units.
 *
 * The SAME measured batch gas as the estimate, priced at a conservative price
 * rather than the live one — so it needs no RPC and holds on a busy block. This
 * is the floor `hasEnoughBalance` is measured against, and deriving it from the
 * measurement (rather than a flat literal) is what keeps the displayed estimate
 * and the reservation from drifting apart.
 */
export function reserveNetworkFee(asset: SupportedAsset): NetworkFeeEstimate {
  const feeWei = MEASURED_BATCH_GAS[asset] * RESERVE_GAS_PRICE_WEI;

  return {
    feeAsset: formatUnits(feeWei / GAS_WEI_PER_TOKEN_UNIT, assetDecimals[asset]),
    source: 'reserve',
  };
}
