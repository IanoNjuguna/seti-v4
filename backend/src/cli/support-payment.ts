/**
 * Support lookup: what actually happened to this payment?
 *
 *   npm run support:payment -- <txHash>
 *   npm run support:payment -- --tx 0xabc...
 *   npm run support:payment -- --user customer@example.com [--limit 10]
 *   npm run support:payment -- --stuck [--limit 50]
 *
 * Read-only. It never writes and never moves funds.
 *
 * Why a script and not an admin UI: there is no role or claim in the schema, so
 * an admin endpoint would need an authorisation model that does not exist yet.
 * A script needs none, works against the same `.env` the backend uses, and is
 * the fastest path to answering the ticket.
 *
 * It lives under `src/` rather than `scripts/` so the repo's gates actually see
 * it: the backend tsconfig includes only files under `src`, so a tool placed
 * outside that tree is neither typechecked nor linted. Under `src` it is both —
 * and it compiles into `dist/`, so `node dist/cli/support-payment.js <hash>`
 * works in a built deployment where `tsx` is a dev dependency.
 *
 * The chain is the authority and the database row is only a claim, so this
 * prints BOTH and then states whether they agree. A row that says `completed`
 * while the chain disagrees is the finding that matters, and it is called out
 * rather than buried.
 *
 * The hash is the right key for this lookup because it is the only handle that
 * exists for every outcome: the customer's wallet shows it whether the payment
 * was recorded, refused before any row was written, or is still pending.
 */
import { decodeEventLog, erc20Abi, type Hex } from 'viem';
import { prisma } from '../lib/prisma.js';
import {
  assetDecimals,
  getTokenContract,
  network,
  publicClient,
} from '../services/chain.js';
import { env } from '../config/env.js';

interface Args {
  txHash?: string;
  userEmail?: string;
  limit: number;
  /** List rows currently sitting in `processing`. */
  stuck: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 10, stuck: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tx' || arg === '--txHash') args.txHash = argv[++i];
    else if (arg === '--user' || arg === '--email') args.userEmail = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i]) || 10;
    else if (arg === '--stuck') args.stuck = true;
    else if (arg.startsWith('0x')) args.txHash = arg;
    else if (!arg.startsWith('--')) args.userEmail ??= arg;
  }
  return args;
}

/**
 * Never print a raw provider error. viem embeds the full request URL — API key
 * included — in `error.metaMessages` and in its `URL:` field, so dumping the
 * error object is a credential leak into the transcript.
 */
function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { name?: string; shortMessage?: string; code?: string | number };
    const parts = [e.name, e.shortMessage ?? (e.code !== undefined ? String(e.code) : undefined)];
    const text = parts.filter(Boolean).join(': ');
    return text || 'unrecognised error (details suppressed to avoid leaking the RPC URL)';
  }
  return String(error);
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
  console.log(`  ${label.padEnd(20)} ${rendered}`);
}

/** Reads the chain's view of a hash: status, block, and every ERC-20 leg. */
async function readChain(txHash: string) {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as Hex });
    // Every asset the SERVED chain lists. Bridged USDC has a different contract
    // per chain, so a map built from the product's list rather than this chain's
    // would miss (or misname) a leg.
    const tokenByAddress = new Map(
      network.assets.map((asset) => [
        getTokenContract(asset, network.network).toLowerCase(),
        asset,
      ])
    );

    const legs: Array<{
      asset: string;
      from: string;
      to: string;
      amount: string;
    }> = [];

    for (const log of receipt.logs) {
      const asset = tokenByAddress.get(log.address.toLowerCase());
      if (!asset) continue;
      try {
        const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
        if (decoded.eventName !== 'Transfer') continue;
        legs.push({
          asset,
          from: String(decoded.args.from),
          to: String(decoded.args.to),
          amount: `${decoded.args.value.toString()} raw`,
        });
      } catch {
        // Not a Transfer log we can decode; skip it rather than guessing.
      }
    }

    return { ok: true as const, receipt, legs };
  } catch (error) {
    return { ok: false as const, reason: describeError(error) };
  }
}

async function byTxHash(txHash: string): Promise<void> {
  console.log(`hash:  ${txHash}`);

  const transaction = await prisma.transaction.findFirst({
    where: { txHash },
    include: { merchant: true, user: true },
  });

  rule('database row (a claim)');
  if (!transaction) {
    console.log('  no transaction row for this hash.');
    console.log('  This is expected when the payment was refused before anything was');
    console.log('  written — the audit trail below is the record in that case.');
  } else {
    field('status', transaction.status);
    field('type', transaction.type);
    field('amount (gross)', transaction.amount);
    field('asset', transaction.asset);
    field('fiatAmount', transaction.fiatAmount);
    field('feeAmount', transaction.feeAmount);
    field('feeUncappedAmount', transaction.feeUncappedAmount);
    field('feeCapped', transaction.feeCapped);
    field('merchantNetAmount', transaction.merchantNetAmount);
    field('fxRate', transaction.fxRate);
    field('fxRateSource', transaction.fxRateSource);
    field('fxRateAsOf', transaction.fxRateAsOf);
    field('merchant', transaction.merchant?.name ?? transaction.merchantId);
    field('merchantPayoutAddr', transaction.merchant?.payoutAddress);
    field('counterparty', transaction.counterparty);
    field('blockNumber', transaction.blockNumber);
    field('settledAt', transaction.settledAt);
    field('failedAt', transaction.failedAt);
    field('createdAt', transaction.createdAt);
    field('user', transaction.user?.email);
    field('metadata', transaction.metadata);
  }

  const auditRows = await prisma.auditLog.findMany({
    where: { txHash },
    orderBy: { createdAt: 'asc' },
  });

  rule('audit trail (the record)');
  if (auditRows.length === 0) {
    console.log('  no audit rows carry this hash.');
    console.log('  A refusal recorded before this build would not have one — re-check');
    console.log('  against the server log for the same window.');
  } else {
    for (const row of auditRows) {
      console.log(`  ${row.createdAt.toISOString()}  ${row.action}`);
      if (row.ip) console.log(`      ip: ${row.ip}`);
      console.log(`      ${JSON.stringify(row.metadata)}`);
    }
  }

  const refusal = auditRows.find((row) => row.action === 'payment.rejected');
  if (refusal) {
    const meta = (refusal.metadata ?? {}) as { code?: string; reason?: string };
    console.log(`\n  refused with code: ${meta.code ?? '(none)'}`);
    console.log(`  reason: ${meta.reason ?? '(none)'}`);
  }

  rule('chain (the authority)');
  const chain = await readChain(txHash);
  if (!chain.ok) {
    console.log(`  receipt unavailable: ${chain.reason}`);
    console.log('  If the payment was broadcast, it may still be pending or the hash may');
    console.log('  belong to a different chain than the one this .env selects.');
  } else {
    field('receipt.status', chain.receipt.status);
    field('blockNumber', chain.receipt.blockNumber.toString());
    field('from', chain.receipt.from);
    field('to', chain.receipt.to);
    console.log('  erc-20 legs:');
    if (chain.legs.length === 0) {
      console.log(
        `    none for a supported asset (${network.assets.join(', ')})`
      );
    }
    for (const leg of chain.legs) {
      const decimals = assetDecimals[leg.asset as keyof typeof assetDecimals];
      const human = Number(leg.amount.split(' ')[0]) / 10 ** decimals;
      console.log(`    ${leg.asset}: ${human} (${leg.amount})`);
      console.log(`      from ${leg.from}`);
      console.log(`      to   ${leg.to}`);
      if (transaction?.merchant?.payoutAddress) {
        const matches =
          leg.to.toLowerCase() === transaction.merchant.payoutAddress.toLowerCase();
        console.log(`      ${matches ? '= merchant payout address' : '!= merchant payout address'}`);
      }
      if (leg.to.toLowerCase() === env.SETI_TREASURY_ADDRESS.toLowerCase()) {
        console.log('      = the Seti treasury (fee leg)');
      }
    }
  }

  rule('verdict');
  const chainStatus = chain.ok ? chain.receipt.status : 'unknown';

  if (!transaction) {
    if (refusal) {
      console.log('  consistent: nothing was recorded, and the refusal is on the audit trail.');
    } else if (auditRows.length > 0) {
      console.log('  nothing recorded; the audit trail has rows but none is a refusal.');
    } else if (chain.ok && chainStatus === 'success') {
      console.log('  ATTENTION: the chain shows a successful transaction but there is no row');
      console.log('  and no audit entry. The backend never saw this payment — check whether the');
      console.log('  client called /transactions/pay and what it got back.');
    } else {
      console.log('  no trace anywhere: no row, no audit entry, and no successful receipt.');
    }
    return;
  }

  if (chainStatus === 'unknown') {
    console.log('  INCONCLUSIVE: the row exists but the chain could not be read. Re-run before');
    console.log('  telling the customer anything.');
    return;
  }

  if (transaction.status === 'completed' && chainStatus !== 'success') {
    console.log('  CONTRADICTION: the row says completed and the chain does not. Treat the');
    console.log('  row as wrong until proven otherwise.');
  } else if (transaction.status === 'completed') {
    console.log('  consistent: recorded completed and the chain receipt succeeded.');
  } else if (transaction.status === 'processing' && chainStatus === 'success') {
    console.log('  STUCK: the chain settled it but the row is still processing. Nothing');
    console.log('  sweeps this today — re-run confirmation, or fix it by hand.');
  } else if (transaction.status === 'processing') {
    console.log('  pending: broadcast but not settled on-chain yet.');
  } else {
    console.log(`  row status is ${transaction.status}; chain says ${chainStatus}.`);
  }
}

async function byUser(email: string, limit: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`no user with email ${email}`);
    return;
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { merchant: true },
  });

  console.log(`user: ${email} (${user.id})`);
  console.log(`last ${transactions.length} transaction(s):\n`);
  for (const tx of transactions) {
    console.log(
      `  ${tx.createdAt.toISOString()}  ${tx.status.padEnd(10)} ${tx.type.padEnd(9)} ` +
        `${String(tx.amount).padStart(14)} ${tx.asset}  fee ${String(tx.feeAmount ?? '-')}  ` +
        `${tx.merchant?.name ?? '-'}`
    );
    console.log(`      ${tx.txHash ?? '(no hash)'}`);
  }
  console.log('\nRun again with a hash to see the full story for one payment.');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log('seti support — payment lookup (read-only)');
  console.log(`chain: ${network.name} (${network.chainId})   env: ${env.NODE_ENV}`);
  console.log(`treasury: ${env.SETI_TREASURY_ADDRESS}`);
  console.log(`fee routing mode: ${env.FEE_ROUTING_MODE}`);

  if (args.txHash && !/^0x[a-fA-F0-9]{1,}$/.test(args.txHash)) {
    console.log('\nThat does not look like a transaction hash. Nothing was looked up.');
    process.exitCode = 2;
    return;
  }

  if (args.txHash) {
    await byTxHash(args.txHash);
  } else if (args.stuck) {
    await stuckRows(args.limit);
  } else if (args.userEmail) {
    await byUser(args.userEmail, args.limit);
  } else {
    console.log('\nusage: npm run support:payment -- <txHash>');
    console.log('   or: npm run support:payment -- --user <email> [--limit 10]');
    console.log('   or: npm run support:payment -- --stuck [--limit 50]');
    process.exitCode = 2;
  }
}

/**
 * Rows sitting in `processing`, oldest first.
 *
 * The sweep resolves these automatically once they are past the age threshold,
 * so the question this answers is "is anything stuck, and would the sweep fix
 * it". A row the chain already shows as settled that is still `processing` well
 * past the threshold means the sweep is not running — which is the failure this
 * whole path exists to prevent.
 */
async function stuckRows(limit: number): Promise<void> {
  const rows = await prisma.transaction.findMany({
    where: { status: 'processing' },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: { merchant: true, user: true },
  });

  rule(`rows in processing (oldest ${rows.length})`);
  if (rows.length === 0) {
    console.log('  none. Every recorded payment has reached a terminal state.');
    return;
  }

  const thresholdMs = env.STUCK_TX_AGE_MINUTES * 60_000;

  for (const row of rows) {
    const ageMs = Date.now() - row.createdAt.getTime();
    const ageMinutes = Math.round(ageMs / 60_000);
    const pastThreshold = ageMs > thresholdMs;

    console.log(
      `  [${pastThreshold ? 'PAST THRESHOLD' : 'in flight'}] ${ageMinutes}m  ` +
        `${String(row.amount)} ${row.asset}  fee ${String(row.feeAmount ?? '-')}  ` +
        `${row.merchant?.name ?? '-'}  ${row.user?.email ?? '-'}`
    );
    console.log(`      ${row.txHash ?? '(no hash on the row)'}`);

    if (!row.txHash) {
      console.log('      nothing to resolve against: no hash was ever recorded.');
      continue;
    }

    const chain = await readChain(row.txHash);
    if (!chain.ok) {
      console.log(`      ${chain.reason.slice(0, 90)}`);
      console.log('      no usable receipt: the sweep reports this rather than resolving it.');
    } else if (chain.receipt.status === 'success') {
      console.log('      chain settled it: the sweep should advance this to completed.');
    } else {
      console.log('      chain shows a reverted transaction: the sweep should mark it failed.');
    }
  }
}

main()
  .catch(async (error) => {
    console.error('support lookup failed:', describeError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
