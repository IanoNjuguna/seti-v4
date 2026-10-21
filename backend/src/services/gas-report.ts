/**
 * The daily gas report.
 *
 * Not a gate. It prints what gas costs the customer today, what our measured
 * constants say next to a real receipt, and whether the estimate had to fall back
 * to the reserve price because the RPC did not answer. It ALWAYS exits 0.
 *
 * Why it exists: `check:send` proves the estimator's arithmetic on every deploy
 * and fails only when a constant is genuinely wrong (issue #107). What it cannot
 * do is tell anyone that the CHAIN moved between deploys, so the first sign of a
 * repricing is a deploy gate going red for a reason unrelated to the diff. This
 * report is that early warning, delivered where the gate lives.
 *
 * The last line is machine-readable: `VERDICT: ok`, or
 * `VERDICT: trip — <reason>; <reason>`. The workflow in
 * `.github/workflows/gas-drift.yml` turns a trip into ONE issue and closes it
 * again once the report is clean.
 *
 * Thresholds are deliberately generous, because a report that cries wolf is
 * worse than no report. All three are claims about the product:
 *
 *   1. a batch costs less than 0.05% of a 1,000-unit ticket
 *   2. no measured constant is more than 3x off a receipt we can read
 *   3. the estimate never has to fall back to the reserve price
 */
import { formatUnits } from 'viem';
import {
  assetsForNetwork,
  estimateNetworkFee,
  publicClientFor,
  MEASURED_BATCH_GAS,
  GAS_WEI_PER_TOKEN_UNIT,
  assetDecimals,
} from './chain.js';
import type { Network } from '../lib/network.js';
import type { SupportedAsset } from './chain.js';

/** A ticket big enough that a fee on it should be invisible. */
const TICKET_UNITS = BigInt(1_000);
/** 0.05% of that ticket: one two-thousandth, in the asset's own units. */
const TICKET_CEILING_DIVISOR = BigInt(2_000);
/** How far a constant may sit from a receipt before it is worth a human's attention. */
const CONSTANT_DRIFT = 3;

/**
 * Receipts we can read BY HASH, from this repo's own history — public data, no
 * credential. Add an entry when a new asset's first real batch lands; the
 * `send.check.ts` anchor covers the served network, this covers what it cannot.
 */
const PINNED_RECEIPTS: Partial<Record<Network, { hash: `0x${string}`; asset: SupportedAsset }[]>> = {
  mainnet: [
    {
      // The first real Seti USDT0 batch: 0.5 to the recipient, 0.01 to the treasury.
      hash: '0xe48006e88cd91cfec9f595788ef16579e6be80248839a58e2ca60f9c7ee086ef',
      asset: 'usdt0',
    },
  ],
};

const NETWORKS: Network[] = ['mainnet', 'testnet'];

/** The product calls the test chain practice; the type calls it testnet. */
function label(network: Network): string {
  return network === 'testnet' ? 'practice' : network;
}

function gwei(wei: bigint): string {
  return `${(Number(wei) / 1e9).toFixed(3)} gwei`;
}

function ticketUnitsFor(asset: SupportedAsset): bigint {
  return TICKET_UNITS * BigInt(10) ** BigInt(assetDecimals[asset]);
}

function ceilingUnitsFor(asset: SupportedAsset): bigint {
  return ticketUnitsFor(asset) / TICKET_CEILING_DIVISOR;
}

/** A batch's share of a ticket, as the customer's own percentage. */
function percentOfTicket(costUnits: bigint, asset: SupportedAsset): string {
  const share = (Number(costUnits) / Number(ticketUnitsFor(asset))) * 100;
  return `${share.toFixed(6)}%`;
}

async function main(): Promise<void> {
  const reasons: string[] = [];

  for (const network of NETWORKS) {
    console.log(`\n${label(network)} — gas price and what a batch costs`);
    console.log('-'.repeat(78));

    // A chain this environment does not configure is not a finding: a practice
    // build has no mainnet tokens and vice versa. Say so and move on.
    let price: bigint;
    try {
      price = await publicClientFor(network).getGasPrice();
    } catch (cause) {
      const message = (cause as Error).message;
      console.log(
        /undefined|chainId|token/i.test(message)
          ? 'not configured in this environment, skipped'
          : `gas price UNAVAILABLE from the RPC: ${message}`
      );
      continue;
    }

    console.log(`gas price ${gwei(price)} (${price} wei)`);
    console.log(
      ['asset'.padEnd(9), 'const gas'.padStart(11), 'batch cost'.padStart(14), '% of ticket'.padStart(13), ' source'].join(' ')
    );

    for (const asset of assetsForNetwork(network)) {
      const constant = MEASURED_BATCH_GAS[asset];
      const costUnits = (constant * price) / GAS_WEI_PER_TOKEN_UNIT;
      const ceiling = ceilingUnitsFor(asset);
      const estimate = await estimateNetworkFee(asset, network);

      console.log(
        [
          asset.padEnd(9),
          String(constant).padStart(11),
          formatUnits(costUnits, assetDecimals[asset]).padStart(14),
          percentOfTicket(costUnits, asset).padStart(13),
          ` ${estimate.source}`,
        ].join(' ')
      );

      if (estimate.source !== 'estimate') {
        reasons.push(`${asset} on ${network} fell back to the reserve price (the RPC did not answer)`);
      }
      if (costUnits > ceiling) {
        reasons.push(
          `${asset} on ${network} costs ${formatUnits(costUnits, assetDecimals[asset])} units, ` +
            `above the 0.05% ceiling of ${formatUnits(ceiling, assetDecimals[asset])}`
        );
      }
    }
  }

  console.log('\npinned receipts — our constant against what a real batch actually spent');
  console.log('-'.repeat(78));

  for (const network of NETWORKS) {
    for (const { hash, asset } of PINNED_RECEIPTS[network] ?? []) {
      try {
        const receipt = await publicClientFor(network).getTransactionReceipt({ hash });
        const constant = MEASURED_BATCH_GAS[asset];
        const gasUsed = receipt.gasUsed;
        const ratio = Number(constant) / Number(gasUsed);
        const price = receipt.effectiveGasPrice ?? BigInt(0);

        console.log(
          `${label(network)} ${hash.slice(0, 10)}… ${asset} gasUsed ${gasUsed} at ${gwei(price)} ` +
            `= ${formatUnits((gasUsed * price) / GAS_WEI_PER_TOKEN_UNIT, assetDecimals[asset])} units`
        );
        console.log(
          `  constant ${constant} vs receipt ${gasUsed}: ${ratio.toFixed(2)}x` +
            (receipt.status === 'success' ? '' : '  (receipt REVERTED)')
        );

        if (ratio > CONSTANT_DRIFT || ratio < 1 / CONSTANT_DRIFT) {
          reasons.push(`${asset} constant is ${ratio.toFixed(2)}x a real receipt on ${network}`);
        }
      } catch (cause) {
        const message = (cause as Error).message;
        if (/undefined|chainId|token/i.test(message)) {
          console.log(`${label(network)} — not configured in this environment, skipped`);
        } else {
          console.log(`${network} ${hash.slice(0, 10)}… unreadable: ${message}`);
          reasons.push(`the pinned ${asset} receipt on ${network} could not be read`);
        }
      }
    }
  }

  console.log('\nVERDICT: ' + (reasons.length ? `trip — ${reasons.join('; ')}` : 'ok'));

  // Never a gate. The workflow decides what a trip means.
  process.exit(0);
}

void main();
