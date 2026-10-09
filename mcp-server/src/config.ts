/**
 * Configuration for the Seti MCP server.
 *
 * Two rules from the repository this server sits in, both deliberate:
 *
 * 1. **Testnet is the default network, not mainnet.** `AGENTS.md` says never to
 *    default to mainnet in development. Every Tempo tool therefore takes an
 *    optional `network` argument and defaults to testnet; mainnet is opt-in.
 * 2. **No secret is ever baked in as a "convenient" default.** The Seti API
 *    token and any custom RPC URL come from the environment only. A missing
 *    token is a surfaced error, not a silent fallback.
 */

export type TempoNetwork = 'mainnet' | 'testnet';

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}

/**
 * Token addresses are the same on both Tempo chains and were verified by
 * `eth_getCode` / `decimals()` / `symbol()` on each (see `docs/internal/prd.md` §8.3).
 * Note `eth_getCode` returns `0xef` for these — an EIP-7702 delegation
 * designator — so "non-empty code" is not the test that identifies them.
 */
export const TOKENS = {
  OUSD: '0x20c0000000000000000000006a37da5c996874be',
  PATHUSD: '0x20c0000000000000000000000000000000000000',
} as const;

export type TokenSymbol = keyof typeof TOKENS;

/** Tempo's enshrined Stablecoin DEX (singleton precompile), per Tempo's docs. */
export const STABLECOIN_DEX = '0xdec0000000000000000000000000000000000000';

/**
 * The Fee AMM, which converts transaction fees into validators' preferred
 * tokens. It is NOT a trading venue — do not confuse it with the DEX.
 */
export const FEE_AMM = '0xfeec000000000000000000000000000000000000';

export function networks(): Record<TempoNetwork, NetworkConfig> {
  return {
    mainnet: {
      chainId: 4217,
      rpcUrl: process.env.TEMPO_MAINNET_RPC_URL ?? 'https://rpc.tempo.xyz',
      explorerUrl: 'https://explore.tempo.xyz',
    },
    testnet: {
      chainId: 42431,
      rpcUrl: process.env.TEMPO_TESTNET_RPC_URL ?? 'https://rpc.moderato.tempo.xyz',
      explorerUrl: 'https://explore.testnet.tempo.xyz',
    },
  };
}

/**
 * Default network, derived from `TEMPO_CHAIN_ID` when it is set. Anything that
 * is not mainnet falls back to testnet rather than the other way round.
 */
export function defaultNetwork(): TempoNetwork {
  return process.env.TEMPO_CHAIN_ID === '4217' ? 'mainnet' : 'testnet';
}

export interface SetiApiConfig {
  baseUrl: string;
  token: string;
}

/**
 * Seti API connection, or `null` when not configured.
 *
 * Returning null rather than throwing at import time lets the server still
 * serve the credential-free Tempo tools to someone who only wants those.
 */
export function setiApiConfig(): SetiApiConfig | null {
  const baseUrl = process.env.SETI_API_BASE_URL;
  const token = process.env.SETI_API_TOKEN;
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

/**
 * Writes are off unless explicitly enabled.
 *
 * `seti_record_payment` persists a payment against an on-chain receipt. That is
 * the one tool here with a side effect, so a host has to opt in — an agent
 * cannot write to the ledger just because it discovered the tool.
 */
export function allowWrites(): boolean {
  return process.env.SETI_MCP_ALLOW_WRITES === 'true';
}
