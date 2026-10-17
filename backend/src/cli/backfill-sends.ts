/**
 * Backfill: give five practice transfers that moved money their ledger rows.
 *
 * WHY THIS EXISTS
 *
 * Five outbound OUSD batches were broadcast from the account's practice wallet
 * and settled on Moderato, but left no `transactions` row. The server could not
 * read their receipts at the time: `getTransactionReceipt` was asked the network
 * it SERVES (mainnet) for hashes that live on Moderato, so every record attempt
 * ended at `receipt-unavailable` — the money is on chain, the ledger never saw it.
 * That read is fixed (`services/chain.ts` reads the network you name), and these
 * five are the rows it cost.
 *
 * WHAT IT WRITES
 *
 * One `p2p_send` row per batch — the account's own money leaving to an external
 * address — in exactly the shape `recordSend` writes after it verifies both legs
 * on chain. Every figure is DERIVED from the receipt, because the chain is the
 * authority and the row is only a claim about it. The legs are decoded by the one
 * shared classifier in `services/receipt.ts` (`classifyReceiptLegs`), never a
 * second copy that could disagree about which leg was the fee.
 *
 * A batch must have the expected THREE legs — the principal to a recipient, the
 * ~2% fee to the practice treasury, and gas to the fee AMM — or the transaction is
 * SKIPPED with its reason printed. Nothing is written that does not verify.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 *  - It does NOT invent a `quoteId`. `transactions` has no such column; a quoteId
 *    only ever feeds a frozen rate at record time and is never persisted. The rate
 *    the customer saw is gone, so the fiat figure on a backfilled row uses the rate
 *    in force WHEN THIS RUNS (`getFxQuote` + `resolveUserFiat`), and the row is
 *    marked a backfill (audit action `send.backfilled`, `metadata.backfill: true`)
 *    so a reconciliation can tell it apart from a live record.
 *  - It does NOT write the recipient's `p2p_receive` side. That is a second
 *    account's ledger; whether they should see a reconstructed row is a separate
 *    decision. Where the recipient is a Seti wallet, the dry run says so.
 *  - It does NOT read, or write, any network but the one these receipts are on.
 *    The receipts are practice (Moderato) receipts, and `getTransactionReceipt` is
 *    called with `'testnet'` explicitly — never the served network, never a bare
 *    `publicClient.getTransactionReceipt`.
 *
 * DRY RUN BY DEFAULT — it writes NOTHING unless passed `--apply`.
 *
 * Usage:
 *   npm run backfill:sends --workspace backend
 *   npm run backfill:sends --workspace backend -- --apply
 *   npm run backfill:sends --workspace backend -- --wallet 0x… --from 39690500 --to 39692700
 *   npm run backfill:sends --workspace backend -- --tx 0x… --tx 0x…
 *
 * It lives under `src/` (not `scripts/`) so the repo's gates see it: the backend
 * tsconfig includes only files under `src`, so a tool placed outside that tree is
 * neither typechecked nor linted.
 */
import { parseAbiItem, type Hex } from 'viem';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { calculateMerchantFee, getMerchantFeeSchedule } from '../services/fees.js';
import { logAuditEvent } from '../services/audit.js';
import { getFxQuote, resolveUserFiat } from '../services/payments.js';
import { classifyReceiptLegs, type ReceiptLeg } from '../services/receipt.js';
import { treasuryAddressFor } from '../config/networks.js';
import {
  FEE_AMM_ADDRESS,
  assetsForNetwork,
  getBlockTimestamp,
  getTokenContract,
  getTransactionReceipt,
  publicClientFor,
  type SupportedAsset,
} from '../services/chain.js';
import { NETWORK_LABEL, type Network } from '../lib/network.js';

/**
 * The network these five transfers are on. PINNED, not the served network.
 *
 * The whole reason the rows are missing is that a read was made on the wrong
 * chain; this tool must not repeat it. The receipts live on Moderato, so every
 * read here names `testnet`, and the tool refuses to be pointed at mainnet.
 */
const NETWORK: Network = 'testnet';

/** The account whose practice transfers never got rows. */
const DEFAULT_WALLET = '0x1aB086a7C2efd4aeF0D82f981C889dA6E048b5DB';

/** The block window the five batches sit in. Narrow on purpose: a stated range. */
const DEFAULT_FROM_BLOCK = 39690500;
const DEFAULT_TO_BLOCK = 39692700;

/**
 * Tolerance on the fee leg's share of the principal, in PERCENTAGE POINTS.
 *
 * The fee is a flat percentage of the principal and, because both legs are read
 * from the same receipt before any conversion, the ratio is independent of the fx
 * rate — so the schedule's own percentage is the exact expectation. The band only
 * absorbs integer division in the token's smallest unit, not a different fee.
 */
const FEE_TOLERANCE_PERCENT = 0.1;

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

/**
 * Why these rows are being reconstructed, stated once so it rides in the audit
 * trail verbatim. A reconciliation reading `send.backfilled` should be able to
 * answer "why was this row not written live" without opening this file.
 */
const BACKFILL_REASON =
  'backfill: five practice batches settled on Moderato while the record path read the ' +
  'served (mainnet) chain for their receipts, so no row was written. Read on the ' +
  "transaction's own network since; figures derived from the receipt, priced at the " +
  'fx rate in force at backfill time (the signed quote is gone).';

interface Args {
  apply: boolean;
  wallet: string;
  fromBlock: number;
  toBlock: number;
  /** Explicit hashes. When empty, the window above is scanned instead. */
  txHashes: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    wallet: DEFAULT_WALLET,
    fromBlock: DEFAULT_FROM_BLOCK,
    toBlock: DEFAULT_TO_BLOCK,
    txHashes: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--wallet') args.wallet = argv[++i];
    else if (arg === '--from') args.fromBlock = Number(argv[++i]);
    else if (arg === '--to') args.toBlock = Number(argv[++i]);
    else if (arg === '--tx') args.txHashes.push(argv[++i]);
    else if (arg === '--network' || arg.startsWith('--network=')) {
      // Accepted only to be REFUSED: pointing this tool at another chain is the
      // mistake it exists to undo.
      const named = arg.includes('=') ? arg : `--network ${argv[i + 1] ?? ''}`;
      throw new Error(
        `--network is not accepted. This tool backfills ${NETWORK_LABEL[NETWORK]} ` +
          `(${NETWORK}) transfers and reads only that chain. (got: ${named.trim()})`
      );
    }
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(args.wallet)) {
    throw new Error(`--wallet must be a 20-byte hex address; received ${args.wallet}`);
  }
  if (args.fromBlock > args.toBlock) {
    throw new Error(`--from (${args.fromBlock}) must not be after --to (${args.toBlock})`);
  }

  return args;
}

function rule(label: string): void {
  console.log(`\n${label}\n${'-'.repeat(label.length)}`);
}

function field(label: string, value: unknown): void {
  // Rendered explicitly rather than via String(unknown): that stringifies a
  // non-plain object to "[object Object]", which reads like data and is not.
  let rendered: string;
  if (value === null || value === undefined || value === '') rendered = '(null)';
  else if (typeof value === 'string') rendered = value;
  else if (typeof value === 'number' || typeof value === 'boolean') rendered = value.toString();
  else if (typeof value === 'bigint') rendered = value.toString();
  else rendered = JSON.stringify(value) ?? '(unserializable)';
  console.log(`  ${label.padEnd(18)} ${rendered}`);
}

/** The row this tool would write — the whole of it, so a reviewer sees every column. */
interface PlannedRow {
  userId: string;
  walletId: string;
  network: Network;
  type: 'p2p_send';
  status: 'completed';
  /** What left the wallet: principal + fee, in the asset's own units. */
  amount: string;
  asset: string;
  counterparty: string;
  txHash: string;
  fiatAmount: string;
  fiatCurrency: string;
  feeAmount: string;
  feeUncappedAmount: string;
  feeCapped: boolean;
  fxRate: string;
  fxRateSource: string;
  fxRateAsOf: Date;
  blockNumber: bigint;
  settledAt: Date;
  description: string;
  metadata: Record<string, unknown>;
}

type Verification =
  | {
      ok: true;
      legs: ReceiptLeg[];
      principal: ReceiptLeg;
      feeLeg: ReceiptLeg;
      gasLeg: ReceiptLeg;
      asset: SupportedAsset;
    }
  | { ok: false; reason: string };

/**
 * Verifies a batch has the shape a recorded send must have, or states why not.
 *
 * Fail closed: anything that does not match the exact three-leg batch is a
 * transaction this tool will NOT write. The rule mirrored from `recordSend` is
 * that "atomic on chain" and "verified against the chain" are different claims,
 * and only the second may write a row.
 */
function verifyBatch(receipt: { status: string; from: string }, legs: ReceiptLeg[], owner: string): Verification {
  const fail = (reason: string): Verification => ({ ok: false, reason });

  if (receipt.status !== 'success') return fail(`receipt status is ${receipt.status}, not success`);

  const principalLegs = legs.filter((leg) => leg.role === 'payment');
  const feeLegs = legs.filter((leg) => leg.role === 'platform-fee');
  const gasLegs = legs.filter((leg) => leg.role === 'gas');

  if (legs.length !== 3) {
    return fail(
      `expected 3 legs (principal, ~2% fee to the treasury, gas); found ${legs.length}`
    );
  }
  if (principalLegs.length !== 1) {
    return fail(`expected exactly one principal leg; found ${principalLegs.length}`);
  }
  if (feeLegs.length !== 1) {
    return fail(`expected exactly one platform-fee leg to the treasury; found ${feeLegs.length}`);
  }
  if (gasLegs.length !== 1) {
    return fail(`expected exactly one gas leg; found ${gasLegs.length}`);
  }

  const [principal] = principalLegs;
  const [feeLeg] = feeLegs;
  const [gasLeg] = gasLegs;
  const lowerOwner = owner.toLowerCase();

  if (receipt.from.toLowerCase() !== lowerOwner) {
    return fail(`transaction was signed by ${receipt.from}, not the account's wallet ${owner}`);
  }
  if (principal.from.toLowerCase() !== lowerOwner) {
    return fail(`principal leg was sent by ${principal.from}, not the account's wallet ${owner}`);
  }
  if (principal.to.toLowerCase() === lowerOwner) {
    return fail('principal leg returns to the account\u2019s own wallet');
  }
  if (feeLeg.to.toLowerCase() !== treasuryAddressFor(NETWORK).toLowerCase()) {
    return fail(`fee leg went to ${feeLeg.to}, not the ${NETWORK_LABEL[NETWORK]} treasury`);
  }
  if (gasLeg.to.toLowerCase() !== FEE_AMM_ADDRESS.toLowerCase()) {
    return fail(`gas leg went to ${gasLeg.to}, not the fee AMM ${FEE_AMM_ADDRESS}`);
  }

  const assets = new Set(legs.map((leg) => leg.asset));
  if (assets.size !== 1) {
    return fail(`legs span more than one asset (${[...assets].join(', ')}); a batch is one token`);
  }

  const principalAmount = Number(principal.amount);
  const feeAmount = Number(feeLeg.amount);
  if (!(principalAmount > 0)) return fail('principal leg is zero');

  const schedule = getMerchantFeeSchedule();
  const observedPercent = (feeAmount / principalAmount) * 100;
  if (Math.abs(observedPercent - schedule.percent) > FEE_TOLERANCE_PERCENT) {
    return fail(
      `fee leg is ${observedPercent.toFixed(4)}% of the principal, not the configured ` +
        `${schedule.percent}% schedule (tolerance ±${FEE_TOLERANCE_PERCENT}pp)`
    );
  }

  return { ok: true, legs, principal, feeLeg, gasLeg, asset: principal.asset as SupportedAsset };
}

/** Rounds to 2dp, avoiding float dust like 10.000000000000002. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The hashes to examine: the explicit `--tx` list, or every outbound Transfer from
 * the wallet in the window, grouped by transaction.
 *
 * Discovery reads the SAME chain the receipts are on (`publicClientFor(NETWORK)`),
 * filtered by the token contract and the `from` topic — so the set is derived from
 * the chain, never from a hardcoded list of hashes.
 */
async function discoverHashes(args: Args): Promise<string[]> {
  if (args.txHashes.length > 0) return args.txHashes;

  const client = publicClientFor(NETWORK);
  const byHash = new Map<string, number>();

  // The chain's OWN asset list: USDT0 is not listed on the practice registry, so
  // scanning for it there would query a contract with no code.
  for (const asset of assetsForNetwork(NETWORK)) {
    const logs = await client.getLogs({
      address: getTokenContract(asset, NETWORK),
      event: TRANSFER_EVENT,
      args: { from: args.wallet as Hex },
      fromBlock: BigInt(args.fromBlock),
      toBlock: BigInt(args.toBlock),
    });

    for (const log of logs) {
      if (!log.transactionHash) continue;
      byHash.set(log.transactionHash, Number(log.blockNumber ?? BigInt(0)));
    }
  }

  return [...byHash.entries()].sort((a, b) => a[1] - b[1]).map(([hash]) => hash);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log('seti backfill — practice sends without ledger rows');
  console.log(`network: ${NETWORK} (${NETWORK_LABEL[NETWORK]})   env: ${env.NODE_ENV}`);
  console.log(`wallet:  ${args.wallet}`);
  console.log(`treasury: ${treasuryAddressFor(NETWORK)}`);
  console.log(`fee mode: ${env.FEE_ROUTING_MODE}`);
  console.log(
    `mode:    ${args.apply ? 'APPLY — rows WILL be written' : 'DRY RUN — nothing is written'}`
  );
  console.log(
    '\nnote: `transactions` has no quoteId column. A quoteId only ever feeds a frozen rate\n' +
      'at record time and is never persisted, so nothing is invented here. The fiat figure\n' +
      'uses the rate in force NOW (getFxQuote + resolveUserFiat) and the row is marked a\n' +
      'backfill (audit `send.backfilled`, metadata.backfill = true).'
  );

  const walletRow = await prisma.wallet.findFirst({
    where: { address: { equals: args.wallet, mode: 'insensitive' }, network: NETWORK },
  });
  if (!walletRow) {
    throw new Error(`No ${NETWORK} wallet row for ${args.wallet}; nothing to attribute rows to.`);
  }
  const userId = walletRow.userId;
  const walletId = walletRow.id;

  const fiatCurrency = await resolveUserFiat(userId);
  const fx = await getFxQuote(fiatCurrency);
  console.log(
    `account: ${userId}   wallet row: ${walletId}   currency: ${fiatCurrency}   ` +
      `rate: ${fx.fiatPerUsd.toFixed(4)} (${fx.source}${fx.stale ? ', stale' : ''})`
  );

  const hashes = await discoverHashes(args);
  console.log(
    `\nhashes: ${hashes.length} (${args.txHashes.length > 0 ? 'explicit --tx list' : `scanned blocks ${args.fromBlock}–${args.toBlock}`})`
  );

  let written = 0;
  let already = 0;
  let skipped = 0;

  for (const hash of hashes) {
    rule(`transaction ${hash}`);

    let receipt;
    try {
      // The transaction's OWN network — never the served one. This is the read
      // that was wrong when the money moved.
      receipt = await getTransactionReceipt(hash as Hex, NETWORK);
    } catch (error) {
      skipped += 1;
      field('SKIP', `receipt unreadable on ${NETWORK}: ${describeError(error)}`);
      continue;
    }

    field('block', receipt.blockNumber.toString());
    const blockTime = await getBlockTimestamp(receipt.blockNumber, NETWORK);
    field('timestamp', blockTime.toISOString());
    field('from', receipt.from);

    const legs = classifyReceiptLegs(receipt, {
      mineAddress: args.wallet,
      treasuryAddress: treasuryAddressFor(NETWORK),
      principalLabel: 'Recipient',
      network: NETWORK,
    });

    console.log('  legs:');
    for (const leg of legs) {
      console.log(
        `    ${leg.role.padEnd(13)} ${leg.asset}  ${leg.amount}\n` +
          `      from ${leg.from}\n      to   ${leg.to}`
      );
    }

    const verified = verifyBatch(receipt, legs, args.wallet);
    if (!verified.ok) {
      skipped += 1;
      field('SKIP', verified.reason);
      continue;
    }

    const { principal, feeLeg, asset } = verified;
    const principalAsset = Number(principal.amount);
    const feeAsset = Number(feeLeg.amount);
    const grossAsset = principalAsset + feeAsset;

    // Fiat figures at the rate in force NOW — the frozen rate is gone, and
    // inventing one would be worse than marking the row a backfill. The fee is the
    // residue of the gross so `gross == principal + fee` holds exactly.
    const principalFiat = round2(principalAsset * fx.fiatPerUsd);
    const feeFiat = round2(grossAsset * fx.fiatPerUsd - principalFiat);

    // Recomputed only to report whether a cap governed; it does not set the fee —
    // the same note `recordSend` carries on this line.
    const feeResult = calculateMerchantFee(principalFiat);

    // Observations a reviewer needs, stated rather than buried: these are the
    // account's outbound transfers and are recorded as sends; if the recipient is
    // a merchant payout address or a Seti wallet, that is worth a human look.
    const merchant = await prisma.merchant.findFirst({
      where: { payoutAddress: { equals: principal.to, mode: 'insensitive' } },
    });
    const recipientWallet = await prisma.wallet.findFirst({
      where: { address: { equals: principal.to, mode: 'insensitive' }, network: NETWORK },
    });
    if (merchant) {
      field('MERCHANT', `recipient is the payout address of merchant "${merchant.name}" (${merchant.id})`);
    }
    if (recipientWallet) {
      field('RECIPIENT', `recipient is a Seti wallet (user ${recipientWallet.userId}); its receive side is not written`);
    }

    const row: PlannedRow = {
      userId,
      walletId,
      network: NETWORK,
      type: 'p2p_send',
      // Already settled on chain: a backfilled row is completed, not processing.
      status: 'completed',
      amount: grossAsset.toFixed(8),
      asset,
      counterparty: principal.to,
      txHash: hash,
      fiatAmount: principalFiat.toFixed(2),
      fiatCurrency,
      feeAmount: feeFiat.toFixed(2),
      feeUncappedAmount: feeResult.uncappedFeeKes.toFixed(2),
      feeCapped: feeResult.cappedByMaxPercent,
      fxRate: fx.fiatPerUsd.toFixed(8),
      fxRateSource: fx.source,
      fxRateAsOf: fx.asOf,
      blockNumber: receipt.blockNumber,
      settledAt: blockTime,
      description: 'Backfilled practice send (settled on chain before it was recorded)',
      metadata: {
        client: {},
        feeRoutingMode: 'batch',
        treasuryFeeObserved: feeAsset.toFixed(8),
        backfill: true,
        backfillReason: BACKFILL_REASON,
      },
    };

    rule('would-be row');
    field('network', `${row.network} (${NETWORK_LABEL[row.network]})`);
    field('type', row.type);
    field('status', row.status);
    field('amount', `${row.amount} ${row.asset}`);
    field('asset', row.asset);
    field('fiatAmount', row.fiatAmount);
    field('fiatCurrency', row.fiatCurrency);
    field('fxRate', row.fxRate);
    field('settledAt', row.settledAt.toISOString());
    field('blockNumber', row.blockNumber.toString());
    field('counterparty', row.counterparty);
    field('feeAmount', row.feeAmount);

    // Idempotency: one row per (txHash, userId, network). A second `--apply` finds
    // the row and writes nothing.
    const existing = await prisma.transaction.findFirst({
      where: { txHash: hash, userId, network: NETWORK },
    });
    if (existing) {
      already += 1;
      field('already', `recorded (transaction ${existing.id}); no second row`);
      continue;
    }

    if (!args.apply) {
      field('action', 'DRY RUN — would write the row above');
      continue;
    }

    try {
      const created = await prisma.transaction.create({
        data: { ...row, metadata: row.metadata as never },
      });
      await logAuditEvent({
        userId,
        action: 'send.backfilled',
        txHash: hash,
        metadata: {
          backfill: true,
          reason: BACKFILL_REASON,
          network: NETWORK,
          walletId,
          recipient: row.counterparty,
          asset: row.asset,
          gross: row.amount,
          fiatAmount: row.fiatAmount,
          fiatCurrency: row.fiatCurrency,
          feeFiat: row.feeAmount,
          fxRate: fx.fiatPerUsd,
          fxRateSource: fx.source,
          blockNumber: row.blockNumber.toString(),
          settledAt: row.settledAt.toISOString(),
        },
      });
      written += 1;
      field('wrote', `transaction ${created.id}`);
    } catch (error) {
      // The unique constraint is the second half of the idempotency guard: a
      // concurrent run that slipped past the pre-check lands here, not in a
      // duplicated row.
      if (isUniqueViolation(error)) {
        already += 1;
        field('already', 'recorded by a concurrent run (unique constraint); no second row');
        continue;
      }
      skipped += 1;
      field('FAILED', describeError(error));
    }
  }

  rule('summary');
  field('examined', hashes.length);
  field(args.apply ? 'written' : 'would write', args.apply ? written : hashes.length - already - skipped);
  field('already recorded', already);
  field('skipped', skipped);
  if (!args.apply) {
    console.log('\n  DRY RUN: nothing was written. Re-run with --apply to write the rows above.');
  }

  // Dry run always exits 0 (even when it finds nothing). In apply mode a genuine
  // skip — a batch that did not verify — is a non-zero exit, so a review cannot
  // mistake a partial backfill for a complete one.
  if (args.apply && skipped > 0) process.exitCode = 1;
}

/** A Prisma unique-constraint violation, without importing the runtime error class. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

/**
 * Never print a raw provider error. viem embeds the full request URL — API key
 * included — in `error.metaMessages` and in its `URL:` field, so any error that
 * carries them is summarised rather than dumped. An ordinary error (a refusal we
 * raised ourselves) is printed in full: its message is the point.
 */
function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as {
      name?: string;
      message?: string;
      shortMessage?: string;
      code?: string | number;
      metaMessages?: unknown;
    };
    if (!e.metaMessages) {
      const plain = [e.name, e.message].filter(Boolean).join(': ');
      if (plain) return plain;
    }
    const parts = [e.name, e.shortMessage ?? (e.code !== undefined ? String(e.code) : undefined)];
    return (
      parts.filter(Boolean).join(': ') ||
      'unrecognised error (details suppressed to avoid leaking the RPC URL)'
    );
  }
  return String(error);
}

main()
  .catch((error) => {
    console.error('backfill failed:', describeError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
