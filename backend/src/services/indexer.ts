import { parseAbiItem, type Hex } from 'viem';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import {
  publicClient,
  network,
  servedNetwork,
  contractsFor,
  PRIMARY_ASSET,
  type SupportedAsset,
  assetDecimals,
} from './chain.js';
import { cursorKeyFor, type Network } from '../lib/network.js';
import { logAuditEvent } from './audit.js';
import { getFxQuote, resolveUserFiat } from './payments.js';
import { sweepStuckTransactions } from './stuck-transactions.js';
import {
  clampRange,
  isEmptyWindow,
  resolveBlockWindow,
  type BlockWindow,
} from './indexer-cursor.js';
import {
  advanceCursor,
  readCursor,
  releaseLock,
  REPLICA_ID,
  tryAcquireLock,
} from './indexer-store.js';

const TRANSFER_EVENT = parseAbiItem([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

/**
 * Every token contract this chain lists, in display order.
 *
 * DERIVED PER CHAIN, not from the product's asset list: a chain may list fewer
 * assets (USDT0 is mainnet-only), and a scan pointed at a contract the chain does
 * not carry queries an address with no code on every tick. `contractsFor` drops
 * those rather than defaulting them.
 */
const ASSET_CONTRACTS: ReadonlyArray<{ asset: SupportedAsset; contract: Hex }> =
  contractsFor(servedNetwork);

const ASSET_ADDRESSES: ReadonlyArray<[SupportedAsset, Hex]> = ASSET_CONTRACTS.map((entry) => [
  entry.asset,
  entry.contract,
]);

const CHAIN_KEY = network.name;

/**
 * The network this indexer scans, and the cursor key it advances.
 *
 * The cursor is PER NETWORK (keyed by the network's chain name): testnet's
 * progress is not mainnet's, so the two advance INDEPENDENTLY and neither can
 * drag the other forward or backwards. `cursorKeyFor` is the ONE mapping from a
 * network to its key.
 */
const SERVED_NETWORK: Network = servedNetwork;

export function networkCursorKey(target: Network = SERVED_NETWORK): string {
  return cursorKeyFor(target);
}

/** Outcome of one indexing pass, for logging and status reporting. */
export interface IndexPassResult {
  /** True when the pass did no work (lock held elsewhere, or already running). */
  skipped: boolean;
  reason?: 'already-running' | 'locked-by-other-replica';
  fromBlock?: bigint;
  toBlock?: bigint;
  currentBlock?: bigint;
  /** True when the window came from the lookback fallback, not a cursor. */
  bootstrap?: boolean;
}

/**
 * In-process guard against overlapping ticks. The DB lock is the real
 * coordination point across replicas; this only stops a slow tick from
 * overlapping the next one on a single process.
 */
let isRunning = false;

/**
 * The assets THIS CHAIN lists, as a set.
 *
 * The wallet row's `asset` is a label on an address that holds every token, so it
 * is used here only to name which ledger label an indexed transfer gets — never
 * to decide whether to look at the address. A row labelled with an asset this
 * chain does not list still has an address worth scanning; it is the label that
 * is unknown, not the money.
 */
const LISTED_ASSETS: ReadonlySet<SupportedAsset> = new Set(
  ASSET_ADDRESSES.map(([asset]) => asset)
);

async function getWalletsByAddress(): Promise<Map<string, { userId: string; walletId: string; asset: SupportedAsset }>> {
  const wallets = await prisma.wallet.findMany({
    where: { status: 'active', network: SERVED_NETWORK },
    select: { id: true, userId: true, address: true, asset: true },
  });

  const map = new Map<string, { userId: string; walletId: string; asset: SupportedAsset }>();
  for (const wallet of wallets) {
    const label = wallet.asset.toLowerCase();
    // Rows written before an asset was supported (`pathusd`, `ousd`) and rows
    // written today (`usdt0`, `usdc.e`) are both labels. An unrecognised label
    // falls back to the primary asset rather than dropping the address, because
    // dropping it would silently stop indexing a wallet the customer is using.
    const asset = (LISTED_ASSETS.has(label as SupportedAsset)
      ? label
      : PRIMARY_ASSET) as SupportedAsset;

    map.set(wallet.address.toLowerCase(), {
      userId: wallet.userId,
      walletId: wallet.id,
      asset,
    });
  }
  return map;
}

async function findMatchingTransaction(txHash: string, walletId: string) {
  return prisma.transaction.findFirst({
    where: { txHash, walletId, network: SERVED_NETWORK },
  });
}

async function confirmTransaction(txHash: string, blockNumber: bigint, userId: string) {
  // Scoped to the row's owner: `txHash` is unique per USER now, so a transfer
  // between two Seti accounts has a row on each side and an unscoped lookup could
  // confirm the wrong one.
  const tx = await prisma.transaction.findFirst({
    where: { txHash, userId, network: SERVED_NETWORK },
    include: { user: true },
  });

  if (!tx || tx.status === 'completed' || tx.status === 'failed' || tx.status === 'reversed') {
    return;
  }

  await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      status: 'completed',
      blockNumber,
      settledAt: new Date(),
    },
  });

  await logAuditEvent({
    userId: tx.userId,
    action: 'transaction.confirm',
    txHash,
    metadata: { blockNumber: blockNumber.toString() },
  });
}

/**
 * Scans one block window's logs, persisting any resulting state.
 *
 * Extracted so the loop in indexOnce can walk a large backlog in bounded
 * steps rather than issuing one enormous log query.
 */
async function scanWindow(window: BlockWindow): Promise<void> {
  const walletMap = await getWalletsByAddress();
  const addresses = Array.from(walletMap.keys());

  if (addresses.length === 0) return;

  for (const [asset, contractAddress] of ASSET_ADDRESSES) {
    const logs = await publicClient.getLogs({
      address: contractAddress,
      event: TRANSFER_EVENT,
      fromBlock: window.fromBlock,
      toBlock: window.toBlock,
    });

    for (const log of logs) {
      const from = String(log.args.from).toLowerCase();
      const to = String(log.args.to).toLowerCase();
      const txHash = log.transactionHash;

      const fromWallet = walletMap.get(from);
      const toWallet = walletMap.get(to);

      if (fromWallet) {
        // Outbound transfer from a Seti wallet: confirm if we have a
        // matching transaction row (payment, p2p_send, withdrawal, fee).
        const existing = await findMatchingTransaction(txHash, fromWallet.walletId);
        if (existing) {
          await confirmTransaction(txHash, log.blockNumber, fromWallet.userId);
        }
      }

      if (toWallet && !fromWallet) {
        // Inbound transfer to a Seti wallet from an external address:
        // create a top-up transaction if one does not already exist. Scoped to the
        // recipient: the same hash can legitimately carry a row for each party.
        const existing = await prisma.transaction.findFirst({
          where: { txHash, userId: toWallet.userId, network: SERVED_NETWORK },
        });

        if (!existing) {
          const decimals = assetDecimals[asset];
          const amount = Number(log.args.value) / 10 ** decimals;

          // The fiat figure, stored at the rate in force when the row is written,
          // in the OWNER's currency — the unit the activity row renders. A row
          // without this figure has to fall back to the stablecoin amount and
          // would overstate the deposit by the fx rate. Same provenance columns as
          // a payment, so a historical row can still be explained.
          const quote = await getFxQuote(await resolveUserFiat(toWallet.userId));

          await prisma.transaction.create({
            data: {
              userId: toWallet.userId,
              walletId: toWallet.walletId,
              network: SERVED_NETWORK,
              type: 'top_up',
              status: 'completed',
              amount: amount.toFixed(8),
              asset: toWallet.asset,
              counterparty: log.args.from,
              txHash,
              blockNumber: log.blockNumber,
              fiatAmount: (amount * quote.fiatPerUsd).toFixed(2),
              fiatCurrency: quote.fiatCurrency,
              fxRate: quote.fiatPerUsd.toFixed(8),
              fxRateSource: quote.source,
              fxRateAsOf: quote.asOf,
              settledAt: new Date(),
            },
          });

          await logAuditEvent({
            userId: toWallet.userId,
            action: 'transaction.confirm',
            txHash,
            metadata: { type: 'top_up', amount },
          });
        }
      }
    }
  }
}

/**
 * Runs one indexing pass: acquire the lock, scan forward from the durable
 * cursor to the chain head, then persist progress.
 *
 * Returns a short summary for logging and for getIndexerStatus.
 *
 * `chainKey` is a parameter, not a constant, so a check can exercise this
 * orchestration against a throwaway key. Driving the live key made the suite
 * mutate real indexing progress and compete for the live lock, so a concurrent
 * indexer could turn a real pass into `locked-by-other-replica` at random. The
 * pass logic is key-agnostic; the caller owns the choice.
 */
export async function indexOnce(chainKey: string = CHAIN_KEY): Promise<IndexPassResult> {
  if (isRunning) {
    return { skipped: true, reason: 'already-running' };
  }

  // Another replica may be scanning. Skip this tick rather than queue behind
  // it; the holder will advance the shared cursor and we resume next tick.
  if (!(await tryAcquireLock(chainKey))) {
    return { skipped: true, reason: 'locked-by-other-replica' };
  }

  isRunning = true;

  try {
    const currentBlock = await publicClient.getBlockNumber();
    const stored = await readCursor(chainKey);

    // A stored cursor of 0n means "never scanned" and must bootstrap. With the
    // default lookback of 0 that resolves to an empty window, so a fresh
    // production cursor does nothing until real activity arrives.
    const storedLastBlock = stored.lastBlock > 0n ? stored.lastBlock : null;
    let window = resolveBlockWindow(
      currentBlock,
      storedLastBlock,
      BigInt(env.INDEXER_BOOTSTRAP_LOOKBACK)
    );

    if (isEmptyWindow(window)) {
      // Fresh cursor with a zero bootstrap lookback: nothing to scan (correct —
      // we refuse to ingest history), but we must still establish the baseline
      // or the cursor stays at 0 forever and the indexer never advances.
      if (stored.lastBlock === 0n) {
        await advanceCursor(chainKey, currentBlock);
        return {
          skipped: false,
          fromBlock: currentBlock,
          toBlock: currentBlock,
          currentBlock,
          bootstrap: true,
        };
      }

      return {
        skipped: false,
        fromBlock: currentBlock,
        toBlock: currentBlock,
        currentBlock,
        bootstrap: window.isBootstrap,
      };
    }

    const firstBlock = window.fromBlock;
    const bootstrap = window.isBootstrap;
    let scannedTo = firstBlock - 1n;

    // Walk forward in bounded windows. clampRange trims a wide backlog to
    // MAX_RANGE per iteration; the cursor advances each pass so we make
    // progress instead of re-requesting the same span.
    while (!isEmptyWindow(window)) {
      const bounded = clampRange(window);
      await scanWindow(bounded);
      scannedTo = bounded.toBlock;
      window = resolveBlockWindow(currentBlock, scannedTo);
    }

    await advanceCursor(chainKey, scannedTo);

    return {
      skipped: false,
      fromBlock: firstBlock,
      toBlock: scannedTo,
      currentBlock,
      bootstrap,
    };
  } finally {
    isRunning = false;
    await releaseLock(chainKey);
  }
}

/**
 * One line for a transport fault, the whole tree for anything else.
 *
 * A public RPC endpoint intermittently refuses a cold connection, and viem's
 * `HttpRequestError` carries a forty-line cause tree — an `AggregateError` of
 * per-address `ETIMEDOUT`s — that says nothing a reader can act on. What a reader
 * CAN act on is which endpoint failed and what it said, so a transport fault is
 * collapsed to that (including the provider's own words when it rejected the call,
 * which is where a cap like "up to a 10 block range" appears). Everything else
 * keeps its stack, because a stack is how it gets diagnosed.
 */
function logIndexerError(scope: 'indexer' | 'sweep', error: unknown): void {
  const transport = error as {
    url?: string;
    shortMessage?: string;
    message?: string;
    cause?: { message?: string };
  };

  if (transport?.url) {
    const detail =
      transport.cause?.message ?? transport.shortMessage ?? transport.message ?? 'request failed';
    console.error(`[${scope}] RPC ${transport.url} — ${detail}`);
    return;
  }

  console.error(`[${scope}] error`, error);
}

/**
 * Starts the periodic indexer.
 *
 * No bootstrap RPC call is needed any more: the cursor is durable, so the
 * first tick simply reads it (0n on a fresh chain) and resolves its own
 * window. That also removes a race where the bootstrap promise resolved after
 * the first tick and reset progress.
 */
export function startIndexer(intervalMs = 15000) {
  const tick = async () => {
    try {
      await indexOnce();
    } catch (error) {
      logIndexerError('indexer', error);
    }

    // Resolving stuck rows deliberately lives here rather than inside
    // indexOnce: that function returns early whenever there is no new block
    // range to scan, which is the steady state, so a sweep inside it would
    // almost never run. The sweep also needs no scan lock — it only ever
    // advances a row that is still `processing`, so a duplicate pass is a
    // no-op rather than a double write.
    try {
      const sweep = await sweepStuckTransactions();

      if (sweep.checked > 0) {
        console.log(
          `[sweep] checked ${sweep.checked}: ${sweep.completed} completed, ` +
            `${sweep.failed} failed, ${sweep.unresolved.length} unresolved`
        );
      }

      for (const row of sweep.unresolved) {
        console.error(
          `[sweep] UNRESOLVED ${row.txHash} stuck ${row.ageMinutes}m: ${row.reason}`
        );
      }
    } catch (error) {
      logIndexerError('sweep', error);
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => clearInterval(interval);
}

export async function getIndexerStatus() {
  const stored = await readCursor(CHAIN_KEY);
  return {
    chain: CHAIN_KEY,
    lastBlock: stored.lastBlock.toString(),
    isRunning,
    replicaId: REPLICA_ID,
    /** True when another replica currently holds the scan lock. */
    lockedByOther: stored.lockedBy !== null && stored.lockedBy !== REPLICA_ID,
    lockedAt: stored.lockedAt?.toISOString() ?? null,
  };
}
