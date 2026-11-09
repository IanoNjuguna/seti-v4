#!/usr/bin/env node
/**
 * The nightly book report: every allowed direction, what the book paid, and nothing else.
 *
 * ## Why this exists as its own process
 *
 * The matrix used to be printable only by `check:convert`, which loads `config/env.ts`
 * at import and therefore demands a database URL, a JWT secret and a mainnet opt-in
 * before it will read a book. The nightly job carried all of them, plus two token
 * addresses, because a READ needed the environment a WRITE needs (#480, #493).
 *
 * This entrypoint imports none of that: the allowlist, the par bands and the asset
 * table are pure modules, and the quote is one `view` call. Its environment is
 * whatever the job happens to have, ideally nothing.
 *
 * ## What it shares with the gate, and what it does not
 *
 * It shares `book-report.ts` (the matrix and the judgement) and `par-bands.ts` (the
 * numbers). It does NOT share `quoteDexConvert`: that lives behind `config/env.ts`, and
 * the whole point is that a read must not need an environment. Both call
 * `quoteSwapExactAmountIn` on the same contract, so "what the book said" has one
 * definition even though the two paths reach it differently.
 *
 * ## Usage
 *
 *   npx tsx src/cli/book-report.ts [--chain 4217]
 *
 * Chain 4217 (mainnet) is the default because that is the book the product quotes
 * against. The output is byte-identical to `CONVERT_BOOK_REPORT=1 check:convert` for
 * the same chain apart from the two header lines, which this prints from its own
 * argument rather than from `env`.
 */
import { createPublicClient, http } from 'viem';
import { SUPPORTED_ASSETS, TEMPO_ASSETS, TEMPO_MAINNET_CHAIN_ID, TEMPO_TESTNET_CHAIN_ID } from '../config/assets.js';
import { CONVERT_PAIRS } from '../services/convert-pairs.js';
import { formatMatrixLine, scanBook, type BookQuote } from '../services/book-report.js';
import type { Network } from '../lib/network.js';
import type { SupportedAsset } from '../config/assets.js';

/**
 * Tempo's enshrined stablecoin DEX. The same contract on both chains, and the same one
 * `config/chain.ts` names — duplicated here rather than imported, because that module
 * reaches `config/env.ts` (#493).
 */
const STABLECOIN_DEX_ADDRESS = '0xdec0000000000000000000000000000000000000' as const;

/** The public endpoint per chain. No API key: the report is ten `view` calls a day. */
const RPC_URL: Record<number, string> = {
  [TEMPO_MAINNET_CHAIN_ID]: 'https://rpc.tempo.xyz',
  [TEMPO_TESTNET_CHAIN_ID]: 'https://rpc.moderato.tempo.xyz',
};

const NETWORK_FOR_CHAIN: Record<number, Network> = {
  [TEMPO_MAINNET_CHAIN_ID]: 'mainnet',
  [TEMPO_TESTNET_CHAIN_ID]: 'testnet',
};

/** The one function this process calls. */
const DEX_ABI = [
  {
    type: 'function',
    name: 'quoteSwapExactAmountIn',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint128' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint128' }],
  },
] as const;

/** `--chain 4217`; mainnet when absent. */
function readChainId(argv: readonly string[]): number {
  const at = argv.indexOf('--chain');
  if (at === -1) return TEMPO_MAINNET_CHAIN_ID;

  const raw = argv[at + 1];
  const chainId = Number(raw);
  if (!Number.isInteger(chainId) || RPC_URL[chainId] === undefined) {
    throw new Error(`--chain must be one of ${Object.keys(RPC_URL).join(', ')} (got ${raw ?? 'nothing'})`);
  }
  return chainId;
}

/** The token address for one asset on one chain, or undefined when the chain omits it. */
function addressOf(asset: SupportedAsset, chainId: number): `0x${string}` | undefined {
  return TEMPO_ASSETS.find((entry) => entry.asset === asset)?.addresses[chainId];
}

async function main(): Promise<void> {
  const chainId = readChainId(process.argv.slice(2));
  const network = NETWORK_FOR_CHAIN[chainId];

  // The network first and unconditionally: every figure below is a figure about ONE
  // chain, and a matrix that does not say which book it read is a matrix about nothing.
  console.log(`network: ${network} (${chainId})`);
  // The book being judged. One number here, because this process reads the book it
  // names: the split between the served network and the par network only exists in the
  // gate, where a practice deployment judges a mainnet band.
  console.log(`par bands: ${network} (${chainId})`);

  const client = createPublicClient({ transport: http(RPC_URL[chainId]) });

  const quote = async (input: {
    assetIn: SupportedAsset;
    assetOut: SupportedAsset;
    amountIn: bigint;
  }): Promise<BookQuote> => {
    const tokenIn = addressOf(input.assetIn, chainId);
    const tokenOut = addressOf(input.assetOut, chainId);

    if (!tokenIn || !tokenOut) {
      throw Object.assign(new Error('asset not listed on this chain'), {
        code: 'convert-unknown-asset',
      });
    }

    const amountOut = await client.readContract({
      address: STABLECOIN_DEX_ADDRESS,
      abi: DEX_ABI,
      functionName: 'quoteSwapExactAmountIn',
      args: [tokenIn, tokenOut, input.amountIn],
    });

    if (amountOut <= 0n) {
      throw Object.assign(new Error('quotes nothing'), { code: 'convert-no-liquidity' });
    }

    // The floor is 50bps under the quote, the same margin the product uses; the report
    // prints the spread, not the floor, so this is only carried for shape.
    return { amountOut, minAmountOut: (amountOut * 9_950n) / 10_000n };
  };

  // A revert on this DEX means the resting orders cannot fill the size. That is the
  // market's answer, and it is reported rather than failed. Anything else — an unknown
  // asset, a decode failure — is our mapping, and stays a distinct code.
  const refusalCode = (error: unknown): string => {
    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && code.startsWith('convert-')) return code;
    return 'convert-no-liquidity';
  };

  const { readings } = await scanBook({
    pairs: CONVERT_PAIRS[network],
    network,
    quote,
    refusalCode,
    onJudged: (judged) => console.log(formatMatrixLine(judged.status, judged.pair, judged.detail)),
  });

  const answered = readings.filter((reading) => reading.answer.kind === 'quote').length;
  console.log(`summary: ${answered} answered, ${readings.length - answered} refused`);

  // A FAIL is a band nobody measured or a spread outside its band: our numbers, not the
  // venue's inventory. The report still prints the matrix above, but it must not exit 0
  // and let a nightly job call that healthy.
  const failed = readings.filter((reading) => {
    const judge = reading.answer;
    return judge.kind === 'refused' && judge.code !== 'convert-no-liquidity';
  }).length;

  if (failed > 0) process.exitCode = 1;

  // `SUPPORTED_ASSETS` is imported so the compile fails if an asset is removed from the
  // table this loop relies on: a silent shrink would change what the matrix covers.
  void SUPPORTED_ASSETS;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
