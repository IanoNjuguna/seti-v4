import {
  createPublicClient,
  http,
  erc20Abi,
  formatUnits,
  type EIP1193RequestFn,
  type Hex,
  type PublicClient,
  type Transport,
} from 'viem';
import {
  network,
  networkConfigFor,
  servedNetwork,
  SUPPORTED_ASSETS,
  PRIMARY_ASSET,
  maskEndpoint,
} from '../config/networks.js';
import { ASSET_DECIMALS } from '../config/assets.js';
import type { Network, SupportedAsset } from '../config/networks.js';

export { network, networkConfigFor, servedNetwork, SUPPORTED_ASSETS, PRIMARY_ASSET };
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

/**
 * How hard we push a PUBLIC endpoint before giving up on one call.
 *
 * The chain's own RPC is a Cloudflare-fronted public node with no SLA, and it
 * intermittently fails to ACCEPT a cold connection: 1 in ~16 single-request
 * processes measured here dies with `ETIMEDOUT` before a byte is exchanged, which
 * reaches viem as `fetch failed` and reaches the indexer as a lost pass. It is not
 * dual-stack (this host has no IPv6 at all and pinning IPv4 changes nothing) and
 * not the endpoint being down (the next request, milliseconds later, answers).
 *
 * So the transport is made patient rather than the endpoint trusted: more attempts
 * with a longer gap, and a request timeout above viem's 10s default because a
 * 2000-block `eth_getLogs` against a public node legitimately takes seconds. At the
 * measured failure rate six attempts leave a per-call failure probability in the
 * 1e-8 range — the difference between a log line every few minutes and a log line
 * that means something.
 */
const RPC_TRANSPORT_OPTIONS = {
  retryCount: 6,
  retryDelay: 400,
  timeout: 20_000,
} as const;

/**
 * A transport that verifies the endpoint's chain id BEFORE its first real call.
 *
 * The served client is the one the product reads and the indexer scans through,
 * so this is where a wrong-chain endpoint must be caught. Verification runs once
 * (see `ensureServedChainId`), lazily, on the first request — deliberately NOT at
 * boot, so no check suite needs the network to start.
 */
function createVerifyingTransport(url: string): Transport {
  const base = http(url, RPC_TRANSPORT_OPTIONS);
  return (params) => {
    const inner = base(params);
    const request: EIP1193RequestFn = async (args) => {
      await ensureServedChainId();
      return inner.request(args);
    };
    return { ...inner, request };
  };
}

const publicClient = createPublicClient({
  chain: tempoChain,
  transport: createVerifyingTransport(network.rpcUrl),
});

export { publicClient };

// ---------------------------------------------------------------------------
// RPC chain-id verification — the RUNTIME, fail-closed guard
// ---------------------------------------------------------------------------
//
// The static guard in `config/networks.ts` proves the CONFIGURATION is coherent
// offline: the served network's endpoint is not the other network's, and the
// legacy pair names the chain its URL belongs to. What it cannot prove offline is
// the endpoint's OWN chain id — that the host actually serves the chain this
// deployment claims. So it is verified here, at FIRST USE, and fails closed.
//
// It must NOT be a boot requirement: `npm run verify` runs with no network, so a
// boot that dialled the RPC would break CI. The first real request through the
// served client therefore pays for one `eth_chainId`; every request after it
// reads the cached verdict and costs nothing.

/**
 * The endpoint reports a chain id this deployment does not serve. Raised at first
 * use and cached, so it refuses every subsequent call rather than letting one
 * wrong-chain read through.
 */
export class RpcChainIdMismatchError extends Error {
  readonly code = 'RPC_CHAIN_ID_MISMATCH';
  /** The chain id this deployment serves. */
  readonly expectedChainId: number;
  /** The chain id the endpoint reported. */
  readonly reportedChainId: number;
  /** The endpoint, MASKED. */
  readonly endpoint: string;

  constructor(expectedChainId: number, reportedChainId: number, endpoint: string) {
    super(
      `[RPC_CHAIN_ID_MISMATCH] Refusing to use the RPC endpoint: it reports chain id ` +
        `${reportedChainId}, but this deployment serves chain ${expectedChainId}. ` +
        `Endpoint: ${maskEndpoint(endpoint)}.\n\n` +
        'Reading through an endpoint on the wrong chain would let this deployment treat another ' +
        'chain\'s blocks, receipts and balances as its own — the failure the boot coherence ' +
        'guard exists to prevent, reached by an endpoint that lies about which chain it holds. ' +
        'Point the served network at an endpoint for its own chain. This check has no bypass.'
    );
    this.name = 'RpcChainIdMismatchError';
    this.expectedChainId = expectedChainId;
    this.reportedChainId = reportedChainId;
    this.endpoint = maskEndpoint(endpoint);
  }
}

/** The one in-flight/settled verification, so the whole process pays for one call. */
let servedChainIdVerification: Promise<void> | undefined;

/**
 * Verify, ONCE, that the served endpoint reports the served chain id. Idempotent
 * and cached: the first caller does the `eth_chainId`, every later caller awaits
 * the same verdict.
 *
 * A MISMATCH is deterministic, so its rejection is cached and every later call
 * fails the same way. An unreachable endpoint is transient — that verdict is NOT
 * cached, so a later call retries — but this call still fails closed.
 */
export function ensureServedChainId(): Promise<void> {
  if (!servedChainIdVerification) servedChainIdVerification = verifyServedChainId();
  return servedChainIdVerification;
}

/** Forget the cached verdict, so the next call re-verifies. For checks only. */
export function resetServedChainIdVerification(): void {
  servedChainIdVerification = undefined;
}

async function verifyServedChainId(): Promise<void> {
  // A SEPARATE, un-wrapped client on purpose: going through the served client
  // would recurse into this very check.
  const probe = createPublicClient({ transport: http(network.rpcUrl) });

  let reported: number;
  try {
    reported = await probe.getChainId();
  } catch (cause) {
    // Could not read the chain id — not a verdict about the chain. Do not cache,
    // so a later call retries, but fail closed for the caller now.
    servedChainIdVerification = undefined;
    throw cause;
  }

  if (reported !== network.chainId) {
    throw new RpcChainIdMismatchError(network.chainId, reported, network.rpcUrl);
  }
}

/**
 * A read client for a NAMED network — the served one by default.
 *
 * The served client above is what the product reads through, because the product
 * only ever acts on the network the deployment serves. A check suite is different:
 * it verifies against a PINNED receipt, and a receipt belongs to one chain. A suite
 * whose verdict must not depend on what the box happens to serve (its whole point —
 * see `payout.check.ts`) therefore reads the receipt through a client for the
 * network THAT RECEIPT is on, and says which one that is.
 *
 * Reads only: nothing here signs, and no caller can use it to send anything.
 */
export function publicClientFor(target: Network): PublicClient {
  const config = networkConfigFor(target);
  const chain = {
    id: config.chainId,
    name: config.displayName,
    nativeCurrency: tempoChain.nativeCurrency,
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: { default: { name: 'Tempo Explorer', url: config.explorerUrl } },
  } as const;

  return createPublicClient({ chain, transport: http(config.rpcUrl) });
}

/**
 * Token contract → asset, FOR A NETWORK.
 *
 * Built from the network's own token map rather than the served one: bridged
 * USDC sits at a different address on each chain, so a practice receipt's USDC.e
 * leg is not the mainnet USDC.e contract's address. Resolving against the served
 * network would fail to recognise the leg and quietly drop it from the receipt.
 */
export function contractsFor(target: Network): { asset: SupportedAsset; contract: Hex }[] {
  const config = networkConfigFor(target);
  return config.assets
    .map((asset) => ({ asset, contract: config.tokens[asset] }))
    .filter((entry): entry is { asset: SupportedAsset; contract: Hex } => entry.contract !== undefined);
}

/** Decimals per asset, from the ONE table — all TIP-20 tokens on Tempo are 6. */
export const assetDecimals: Record<SupportedAsset, number> = Object.fromEntries(
  SUPPORTED_ASSETS.map((asset) => [asset, ASSET_DECIMALS])
) as Record<SupportedAsset, number>;

/** The assets a NETWORK lists, in display order. What a balance sums over. */
export function assetsForNetwork(target: Network = servedNetwork): readonly SupportedAsset[] {
  return networkConfigFor(target).assets;
}

/** True when a chain lists an asset at all — false for USDT0 on practice. */
export function isListedOn(asset: SupportedAsset, target: Network = servedNetwork): boolean {
  return networkConfigFor(target).tokens[asset] !== undefined;
}

export async function getOnChainBalance(
  address: Hex,
  asset: SupportedAsset = PRIMARY_ASSET,
  target: Network = servedNetwork
): Promise<string> {
  // The contract belongs to the CHAIN, not to the process: USDC.e is a different
  // address on each network, so reading the served network's map for a practice
  // address would query a contract that has never seen it and return 0.
  const contract = networkConfigFor(target).tokens[asset];
  if (!contract) {
    throw new Error(
      `This network does not list ${asset}, so there is no token contract to read. ` +
        `Listed on ${target}: ${networkConfigFor(target).assets.join(', ')}.`
    );
  }

  // The ADDRESS is on a network, and the caller knows which one — it found the
  // wallet row by it. Reading the served chain for a practice address returns 0,
  // which is a wrong answer rather than a missing one.
  const client = target === servedNetwork ? publicClient : publicClientFor(target);
  const rawBalance = await client.readContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  });

  return formatUnits(rawBalance, assetDecimals[asset]);
}

/**
 * A transaction's receipt, read from the network it is actually ON.
 *
 * `target` exists because the account's network is PER-ACCOUNT: an account acting
 * on practice while this deployment serves live has practice transactions and live
 * transactions in the same table, and asking the served chain for a hash it has
 * never seen throws `TransactionReceiptNotFoundError` — which is how a receipt
 * fails to load while its row renders perfectly in Activity.
 *
 * The served network keeps the VERIFYING client (`publicClient`, whose transport
 * checks the endpoint's chain id at first use); any other network gets a plain
 * client for that chain. Defaulting to the served network is what keeps every
 * existing caller — the money paths — behaving exactly as before.
 */
export async function getTransactionReceipt(txHash: Hex, target: Network = servedNetwork) {
  const client = target === servedNetwork ? publicClient : publicClientFor(target);
  return client.getTransactionReceipt({ hash: txHash });
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

/**
 * The wall-clock time a block was mined, on the network that block is on.
 *
 * Network-scoped for the same reason as `getTransactionReceipt`: a practice block
 * number means nothing on the live chain, and a receipt must print the time of the
 * block it actually came from.
 */
export async function getBlockTimestamp(
  blockNumber: bigint,
  target: Network = servedNetwork
): Promise<Date> {
  const client = target === servedNetwork ? publicClient : publicClientFor(target);
  const block = await client.getBlock({ blockNumber });
  return new Date(Number(block.timestamp) * 1000);
}

/**
 * Which of our assets a token address is, on a given network.
 *
 * Case-insensitive because the address in a log is whatever the contract emitted,
 * while our config stores its own casing — an exact-match lookup would silently
 * fail to recognise our own token.
 *
 * Scoped to a network because the addresses are: bridged USDC is a different
 * contract on each chain, so a lookup that spanned every chain would name an
 * asset for an address that belongs to the other one.
 */
export function assetForContract(
  address: string,
  target: Network = servedNetwork
): SupportedAsset | null {
  const lowered = address.toLowerCase();
  for (const entry of contractsFor(target)) {
    if (entry.contract.toLowerCase() === lowered) return entry.asset;
  }
  return null;
}

export async function waitForTransactionReceipt(
  txHash: Hex,
  timeout = 30_000,
  pollingInterval = 2_000,
  target: Network = servedNetwork
) {
  // Network-scoped for the same reason as `getTransactionReceipt`: waiting on the
  // served chain for a hash that lives on the account's chain waits forever and
  // then reports a timeout, which reads as "the payment never landed".
  const client: PublicClient = target === servedNetwork ? publicClient : publicClientFor(target);

  return client.waitForTransactionReceipt({
    hash: txHash,
    timeout,
    pollingInterval,
  });
}

/**
 * The token contract for an asset ON A NETWORK — the address that gets signed.
 *
 * Required network, defaulting to the served one only because the served network
 * is what a read-only caller means. Every money path passes the transfer's own
 * network explicitly: USDC.e is a different contract on each chain, so resolving
 * this against the served network would query and sign the wrong token.
 */
export function getTokenContract(asset: SupportedAsset, target: Network = servedNetwork): Hex {
  const contract = networkConfigFor(target).tokens[asset];
  if (!contract) {
    throw new Error(
      `Refusing to resolve ${asset} on ${target}: this chain does not list that asset ` +
        `(listed: ${networkConfigFor(target).assets.join(', ')}).`
    );
  }
  return contract;
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
  const contract = getTokenContract(asset);
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
  // Not yet measured: no Seti receipt spends USDT0 or USDC.e. Both quote the
  // PESSIMISTIC end of the measured range until one exists, because this figure
  // decides whether a customer can afford a payment — over-reserving refuses a
  // payment that would have fitted, under-reserving lets one revert after the
  // money has been signed for. Re-measure with
  // `npm run prove:batch -- --asset=usdt0` (or usdc.e) and replace the value.
  usdt0: BigInt(790_472),
  'usdc.e': BigInt(790_472),
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
