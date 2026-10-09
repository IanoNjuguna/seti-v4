/**
 * Credential-free Tempo tools.
 *
 * These need no Seti account and no API token: they read the chain and build
 * unsigned calldata. That matters because the Seti API has no public
 * authentication yet, so without these a third-party developer would have
 * nothing they could actually run.
 *
 * Nothing here signs anything. `seti_build_payment_transfer` returns calldata
 * for a wallet the caller controls — the server never holds a key.
 */
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { tempo, tempoModerato } from 'viem/chains';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { STABLECOIN_DEX, TOKENS, defaultNetwork, networks, type TempoNetwork } from '../config.js';
import { ToolError, toolError, toolJson } from '../errors.js';

const CHAINS = { mainnet: tempo, testnet: tempoModerato } as const;

function configFor(network: TempoNetwork) {
  const n = networks()[network];
  return { ...n, chain: CHAINS[network] };
}

function clientFor(network: TempoNetwork) {
  const { rpcUrl, chain } = configFor(network);
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

/** Accepts a known symbol or a raw address. Symbols keep the common case short. */
function resolveToken(symbolOrAddress: string): Address {
  const key = symbolOrAddress.trim().toUpperCase();
  if (key in TOKENS) return TOKENS[key as keyof typeof TOKENS] as Address;
  if (isAddress(symbolOrAddress)) return symbolOrAddress as Address;
  throw new ToolError(
    `Unknown token "${symbolOrAddress}". Pass one of ${Object.keys(TOKENS).join(', ')} or a 0x address.`
  );
}

/**
 * Validates an address, and says *why* it failed when it is a checksum problem.
 *
 * `isAddress` is strict about EIP-55: a mixed-case address whose checksum is
 * wrong is rejected, because that mismatch is exactly what a typo looks like.
 * The failure mode that matters in this repo is that the backend's own
 * `isValidEvmAddress` is a regex only (`/^0x[a-fA-F0-9]{40}$/`), so the API will
 * accept and store an address that viem — and therefore the mobile signing path —
 * refuses. A bare "invalid address" hides that, and the caller's next move
 * differs: fix the checksum, do not go looking for a different merchant.
 */
function requireAddress(value: string, label: string): Address {
  if (isAddress(value)) return value as Address;

  if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
    let corrected = '';
    try {
      corrected = getAddress(value);
    } catch {
      corrected = '';
    }
    throw new ToolError(
      `${label} "${value}" is 20 bytes but fails its EIP-55 checksum, so a viem-based client will ` +
        'refuse to build a transfer to it.' +
        (corrected ? ` The checksummed form is ${corrected}.` : '') +
        ' All-lowercase is also accepted. Note the Seti backend only regex-checks addresses, so it ' +
        'stores this value happily while the client cannot sign to it.'
    );
  }

  throw new ToolError(`${label} "${value}" is not a 20-byte hex address.`);
}

const dexAbi = [
  {
    name: 'quoteSwapExactAmountIn',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint128' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint128' }],
  },
] as const;

const networkArg = z
  .enum(['mainnet', 'testnet'])
  .optional()
  .describe('Which Tempo network to read. Defaults to testnet unless TEMPO_CHAIN_ID=4217 is set.');

export function registerTempoTools(server: McpServer): void {
  server.registerTool(
    'tempo_inspect_address',
    {
      title: 'Inspect a Tempo address',
      description:
        'Validate a 20-byte address and report whether it has deployed code on Tempo. Use it before ' +
        'sending funds: a transfer to an address with no code can succeed as a silent no-op rather ' +
        'than reverting. Caveat: Tempo TIP-20 tokens answer eth_getCode with 0xef (an EIP-7702 ' +
        'delegation designator), so code presence alone does not identify a token.',
      inputSchema: {
        address: z.string().describe('The 0x address to inspect.'),
        network: networkArg,
      },
    },
    async ({ address, network }) => {
      try {
        requireAddress(address, 'address');
        const selected = network ?? defaultNetwork();
        const { chainId, explorerUrl, chain } = configFor(selected);
        const client = clientFor(selected);
        const code = await client.getCode({ address: address as Address });

        const hasCode = Boolean(code && code !== '0x');
        const isEip7702Designator = code === '0xef';
        return toolJson({
          address,
          network: chain.name,
          chainId,
          hasDeployedCode: hasCode,
          looksLikeEip7702Designator: isEip7702Designator,
          code: code ?? '0x',
          explorer: `${explorerUrl}/address/${address}`,
          interpretation: hasCode
            ? isEip7702Designator
              ? 'This is a TIP-20-style delegated account (code is 0xef). It is a real target.'
              : 'This address has deployed code.'
            : 'No code at this address — it is an EOA, or nothing is deployed there yet.',
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'tempo_get_balance',
    {
      title: 'Read a TIP-20 stablecoin balance',
      description:
        'Read the balance of a Tempo TIP-20 stablecoin (OUSD or pathUSD) for an address, along with ' +
        'the token decimals and symbol so the number can be trusted rather than assumed.',
      inputSchema: {
        owner: z.string().describe('Address whose balance to read.'),
        token: z.string().optional().describe('OUSD (default), PATHUSD, or a 0x token address.'),
        network: networkArg,
      },
    },
    async ({ owner, token, network }) => {
      try {
        if (!isAddress(owner)) requireAddress(owner, 'owner');
        const selected = network ?? defaultNetwork();
        const tokenAddress = resolveToken(token ?? 'OUSD');
        const client = clientFor(selected);

        const [raw, decimals, symbol] = await Promise.all([
          client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [owner as Address],
          }),
          client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
          client
            .readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'symbol' })
            .catch(() => 'unknown'),
        ]);

        return toolJson({
          network: configFor(selected).chain.name,
          owner,
          token: { address: tokenAddress, symbol, decimals },
          balanceBaseUnits: raw.toString(),
          balance: formatUnits(raw, Number(decimals)),
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'tempo_get_dex_quote',
    {
      title: 'Quote a stablecoin swap on the Tempo DEX',
      description:
        "Quote an exact-input swap on Tempo's enshrined Stablecoin DEX (the onchain orderbook, not the " +
        'Fee AMM). Read-only: a quote does not reserve liquidity, and the real swap must enforce a ' +
        'minimum output. Use it to see the price and the spread before moving funds.',
      inputSchema: {
        tokenIn: z.string().describe('Token being sold: OUSD, PATHUSD, or a 0x address.'),
        tokenOut: z.string().describe('Token being bought: OUSD, PATHUSD, or a 0x address.'),
        amountIn: z.string().describe('Exact input amount, in whole token units (e.g. "100.5").'),
        network: networkArg,
      },
    },
    async ({ tokenIn, tokenOut, amountIn, network }) => {
      try {
        const selected = network ?? defaultNetwork();
        const client = clientFor(selected);
        const inToken = resolveToken(tokenIn);
        const outToken = resolveToken(tokenOut);

        const decimals = Number(
          await client.readContract({ address: inToken, abi: erc20Abi, functionName: 'decimals' })
        );
        const outDecimals = Number(
          await client.readContract({ address: outToken, abi: erc20Abi, functionName: 'decimals' })
        );

        let amountInBaseUnits: bigint;
        try {
          amountInBaseUnits = parseUnits(amountIn, decimals);
        } catch {
          throw new ToolError(`"${amountIn}" is not a valid decimal amount.`);
        }
        if (amountInBaseUnits <= 0n) throw new ToolError('amountIn must be greater than zero.');

        let amountOut: bigint;
        try {
          amountOut = await client.readContract({
            address: STABLECOIN_DEX,
            abi: dexAbi,
            functionName: 'quoteSwapExactAmountIn',
            args: [inToken, outToken, amountInBaseUnits],
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/InsufficientLiquidity/i.test(message)) {
            throw new ToolError(
              `The orderbook has no liquidity for ${amountIn} ${tokenIn} → ${tokenOut} on ${configFor(selected).chain.name}. ` +
                'Try a smaller amountIn, or the other network — Tempo testnet depth is far thinner than mainnet.'
            );
          }
          throw error;
        }

        // Spread as a percentage. Scaled by 1e6 before the integer division so
        // large sizes do not truncate to 0, then divided back: at 1e6 in/999900
        // out this yields 0.01 (1 bp), which is what a live probe measured.
        const spreadPercent = Number((amountInBaseUnits - amountOut) * 1_000_000n / amountInBaseUnits) / 10_000;
        return toolJson({
          network: configFor(selected).chain.name,
          dex: STABLECOIN_DEX,
          tokenIn: { address: inToken, amount: amountIn, decimals },
          tokenOut: {
            address: outToken,
            amount: formatUnits(amountOut, outDecimals),
            decimals: outDecimals,
          },
          amountInBaseUnits: amountInBaseUnits.toString(),
          amountOutBaseUnits: amountOut.toString(),
          spreadPercent: Number(spreadPercent.toFixed(6)),
          note: 'Quote only. A swap must still set a minimum output, because the book can move before it lands.',
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'seti_build_payment_transfer',
    {
      title: 'Build an unsigned stablecoin payment',
      description:
        'Build the ERC-20 transfer calldata to pay a merchant on Tempo, for a wallet YOU control to ' +
        'sign. This server never signs and never holds a key. Returns the token address, the ' +
        'recipient, the base-unit amount, and the calldata.',
      inputSchema: {
        to: z.string().describe("The merchant's payout address."),
        amount: z.string().describe('Amount in whole token units, e.g. "51" for 51 OUSD.'),
        token: z.string().optional().describe('OUSD (default), PATHUSD, or a 0x token address.'),
        network: networkArg,
      },
    },
    async ({ to, amount, token, network }) => {
      try {
        if (!isAddress(to)) requireAddress(to, 'recipient');
        const selected = network ?? defaultNetwork();
        const client = clientFor(selected);
        const tokenAddress = resolveToken(token ?? 'OUSD');

        const decimals = Number(
          await client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' })
        );
        let value: bigint;
        try {
          value = parseUnits(amount, decimals);
        } catch {
          throw new ToolError(`"${amount}" is not a valid decimal amount.`);
        }
        if (value <= 0n) throw new ToolError('amount must be greater than zero.');

        const data: Hex = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to as Address, value],
        });

        return toolJson({
          network: configFor(selected).chain.name,
          chainId: configFor(selected).chainId,
          transaction: { to: tokenAddress, data, value: '0' },
          decoded: {
            token: tokenAddress,
            recipient: to,
            amountInTokenUnits: formatUnits(value, decimals),
            amountBaseUnits: value.toString(),
            decimals,
          },
          reminder:
            'The recipient must be verified before signing. If this payment is a Seti merchant payment, ' +
            'the amount should be the GROSS (principal + fee) — get it from seti_preview_payment rather ' +
            'than computing it, because the fee schedule is server-side.',
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );
}
