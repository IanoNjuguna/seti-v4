/**
 * `npm run check:assets`: the facts this app assumes about its own token config.
 *
 * Run with:  npm run check:assets
 *
 * WHY THIS EXISTS (#468)
 *
 * `config/assets.ts` warns, in prose, that "an address belongs to a CHAIN" and that
 * copying a mainnet address into the practice slot would sign a transfer against an
 * address that holds nothing. It also claims decimals are "asserted, not assumed".
 * Neither claim had anything behind it: `check:address` validates EIP-55 syntax and
 * never touches a chain, and no suite anywhere read `decimals()` on chain.
 *
 * Every fact here is SELF-REFERENTIAL, which is what makes it checkable. It is our
 * config about our config: a token address we wrote down, the number of decimals we
 * wrote next to it, and the treasury we pay fees to. None of it depends on a third
 * party's inventory, so unlike the convert book this suite has no `report` for
 * market reasons. It has one for the reason a gate must never hang on somebody
 * else's node: if a network's RPC cannot be reached at all, the network's chain
 * assertions are REPORTED, not failed. What we wrote down is still asserted either
 * way.
 *
 * WHY `decimals()` AND NOT `eth_getCode`
 *
 * The obvious existence test is wrong on this chain. Every TIP-20 returns `0xef` from
 * `eth_getCode`, including the ones that hold nothing, which is the invalid check
 * AGENTS.md records: it cannot distinguish a deployed token from an undeployed one.
 * A call that has to answer, like `decimals()`, can.
 *
 * WHAT THIS DOES NOT COVER
 *
 * Merchant payout addresses are data, not config. This suite checks what the
 * environment declares; the refusal that keeps a payout from colliding with the
 * treasury at payment time is `treasury-is-payee` in `services/transactions.ts`.
 */
import { isValidEvmAddress } from '../lib/address.js';
import { networkConfigFor, publicClientFor } from '../services/chain.js';
import { ASSET_DECIMALS, SUPPORTED_ASSETS, TEMPO_ASSETS } from './assets.js';
import type { Network } from '../lib/network.js';
import type { SupportedAsset } from './assets.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/** Not a pass and not a failure: a fact about the venue that a merge cannot fix. */
function report(label: string, detail = ''): void {
  console.log(`     ${label}${detail ? `  ${detail}` : ''}`);
}

const NETWORKS: readonly Network[] = ['mainnet', 'testnet'];

/** The address this product files an asset at, on a network, or undefined. */
function addressFor(asset: SupportedAsset, network: Network): `0x${string}` | undefined {
  return networkConfigFor(network).tokens[asset];
}

const abi = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
] as const;

async function main(): Promise<void> {
  // ---------------------------------------------------------------------------
  // (a) PURE: the config asserts about itself, no chain needed
  // ---------------------------------------------------------------------------
  console.log('the table itself:');

  for (const network of NETWORKS) {
    const listed = SUPPORTED_ASSETS.filter((asset) => addressFor(asset, network) !== undefined);
    const addresses = listed.map((asset) => addressFor(asset, network)!.toLowerCase());

    check(
      `${network}: every listed asset has a 20-byte hex address`,
      listed.every((asset) => isValidEvmAddress(addressFor(asset, network)!)),
      `${listed.length} listed`
    );

    // The collision that would pass every other test: two labels, one address. A
    // convert between them would look like a cross-asset swap that moves nothing,
    // and a receipt would match the wrong token's transfer.
    check(
      `${network}: no two assets share an address`,
      new Set(addresses).size === addresses.length,
      addresses.length ? `${addresses.length} assets` : 'no assets listed'
    );

    const treasury = networkConfigFor(network).treasuryAddress;

    // Since #472 the treasury is optional at import and required only where a payment
    // is built, so "is it set" is its own assertion here rather than a type guarantee.
    // A deployment that cannot pay must fail this gate, not the first customer.
    check(
      `${network}: the treasury address is configured`,
      typeof treasury === 'string' && treasury.length > 0,
      treasury ?? '(unset)'
    );
    check(
      `${network}: the treasury address is 20-byte hex`,
      typeof treasury === 'string' && isValidEvmAddress(treasury),
      treasury ?? '(unset)'
    );

    // If the treasury IS a token contract, every fee is a transfer to a token, which
    // succeeds and is unreadable as a fee.
    check(
      `${network}: the treasury is not one of our token addresses`,
      typeof treasury === 'string' && !addresses.includes(treasury.toLowerCase()),
      treasury ?? '(unset)'
    );
  }

  check(
    'every supported asset is listed on at least one network',
    SUPPORTED_ASSETS.every((asset) => NETWORKS.some((network) => addressFor(asset, network) !== undefined)),
    SUPPORTED_ASSETS.join(', ')
  );

  // The table's own decimal claim, against the constant the money maths uses.
  check(
    'every asset entry declares the decimals the money maths uses',
    TEMPO_ASSETS.every((entry) => entry.decimals === ASSET_DECIMALS),
    `ASSET_DECIMALS=${ASSET_DECIMALS}`
  );

  // ---------------------------------------------------------------------------
  // (b) THE CHAIN: the address is a real token there, with six decimals
  // ---------------------------------------------------------------------------
  for (const network of NETWORKS) {
    console.log(`\n${network} (chain ${networkConfigFor(network).chainId}):`);

    const listed = SUPPORTED_ASSETS.filter((asset) => addressFor(asset, network) !== undefined);
    if (listed.length === 0) {
      report(`${network} lists no assets, so there is nothing to read`);
      continue;
    }

    const client = publicClientFor(network);

    // One read that proves the RPC answers. Without it, a network outage and a
    // missing token are the same exception, and reporting an outage as a failed
    // assertion is how a gate becomes something people retry instead of read.
    let reachable = true;
    try {
      await client.getBlockNumber();
    } catch (error) {
      reachable = false;
      report(`${network}: the RPC did not answer, so the token reads were skipped`, String(error).slice(0, 60));
    }
    if (!reachable) continue;

    for (const asset of listed) {
      const address = addressFor(asset, network)!;

      let decimals: number | null = null;
      let symbol: string | null = null;
      try {
        decimals = Number(await client.readContract({ address, abi, functionName: 'decimals' }));
        symbol = await client.readContract({ address, abi, functionName: 'symbol' });
      } catch {
        decimals = null;
      }

      check(
        `${network}: ${asset} answers on chain at ${address}`,
        decimals !== null,
        decimals === null ? 'no token at this address on this chain' : symbol ?? ''
      );

      // Only meaningful when the token answered, and the failure it catches is a
      // 1e12 error in every figure the product prints.
      if (decimals !== null) {
        check(
          `${network}: ${asset} has ${ASSET_DECIMALS} decimals`,
          decimals === ASSET_DECIMALS,
          `read ${decimals}`
        );
        check(
          `${network}: ${asset} reports a symbol`,
          typeof symbol === 'string' && symbol.length > 0,
          String(symbol)
        );
      }
    }
  }

  console.log('\n' + '-'.repeat(74));
  console.log(
    failures === 0 ? `All ${total} checks passed.` : `${failures} of ${total} checks FAILED.`
  );
  if (failures > 0) process.exit(1);
}

void main();
