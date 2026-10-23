import { parseAbiItem, type Hex, type TransactionReceipt } from 'viem';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { treasuryAddressFor } from '../config/networks.js';
import {
  publicClient,
  network,
  servedNetwork,
  contractsFor,
  getTokenContract,
  PRIMARY_ASSET,
  type SupportedAsset,
  assetDecimals,
} from './chain.js';
import {
  feeLegsFromReceipt,
  memoFromBytes32,
  matchChargeTransfers,
  sweepExpiredCharges,
  type ChargeFeeLookup,
  type ChargeTransferCandidate,
} from './charge-match.js';
import { distinctPendingRecipients, unitsToAmount } from './charge-store.js';
import { deliverDueWebhooks } from './charge-webhook.js';
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
import { STABLECOIN_DEX_ADDRESS } from './chain.js';

const TRANSFER_EVENT = parseAbiItem([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

/**
 * A TIP-20 transfer that carries a memo — the ONLY way a payment can be matched to a
 * charge.
 *
 * Tempo's TIP-20 extends ERC-20 with a 32-byte memo (`transferWithMemo`), emitted
 * beside the plain `Transfer`. A charge's id travels in that memo, so a charge
 * payment is a memo transfer and an ordinary transfer can never settle one. Param
 * name differs too (`amount` here, `value` above) because the two events are written
 * differently on chain — reading the wrong field yields `undefined`, not zero.
 */
const TRANSFER_WITH_MEMO_EVENT = parseAbiItem([
  'event TransferWithMemo(address indexed from, address indexed to, uint256 amount, bytes32 indexed memo)',
]);

/**
 * How many pending charge recipients one window's log query may carry.
 *
 * The per-contract query filters on `to` at the RPC, which is what keeps this from
 * reading every transfer on the network, and an address list is finite. Beyond the
 * cap the extra recipients are logged and left to the next pass: a deployment with
 * more than this many live charges inside one 2,000-block window has a different
 * problem, and silently issuing an enormous query is not the fix.
 */
const CHARGE_MATCH_ADDRESS_LIMIT = 500;

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

  // Charges have no Seti wallet: a recipient is any address a stranger signed for.
  // Their recipients are read ONCE per window and passed to the RPC as a `to` filter,
  // so this adds one narrow query per asset and never a scan of the whole network.
  const chargeRecipients = await distinctPendingRecipients(SERVED_NETWORK, CHARGE_MATCH_ADDRESS_LIMIT);
  if (chargeRecipients.length === CHARGE_MATCH_ADDRESS_LIMIT) {
    console.warn(
      `[indexer] ${CHARGE_MATCH_ADDRESS_LIMIT} pending charge recipients is the scan cap; ` +
        'charges beyond it are only matched in a later window.'
    );
  }

  if (addresses.length === 0 && chargeRecipients.length === 0) return;

  /** Transfers the charge matcher will consider, with their asset label. */
  const chargeTransfers: ChargeTransferCandidate[] = [];

  for (const [asset, contractAddress] of ASSET_ADDRESSES) {
    const logs =
      addresses.length > 0
        ? await publicClient.getLogs({
            address: contractAddress,
            event: TRANSFER_EVENT,
            fromBlock: window.fromBlock,
            toBlock: window.toBlock,
          })
        : [];

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

      // A payout from the DEX is one leg of a SWAP, not money arriving from
      // outside: the customer's own stablecoin went the other way in the same
      // transaction. Recording it as a deposit told the ledger the account had been
      // topped up (and, because the unique key is (txHash, userId, network), it also
      // stopped the convert path from recording what actually happened). Found by
      // the first end-to-end settlement run (#105).
      const fromDex = log.args.from?.toLowerCase() === STABLECOIN_DEX_ADDRESS.toLowerCase();

      if (toWallet && !fromWallet && !fromDex) {
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

    // The charge match, from the SAME window and the SAME contracts. Only memo
    // transfers: a charge id travels in the 32-byte memo, and an ordinary transfer
    // has none, so it cannot settle a charge (the classifier refuses it by code).
    if (chargeRecipients.length > 0) {
      const memoLogs = await publicClient.getLogs({
        address: contractAddress,
        event: TRANSFER_WITH_MEMO_EVENT,
        args: { to: chargeRecipients as `0x${string}`[] },
        fromBlock: window.fromBlock,
        toBlock: window.toBlock,
      });

      for (const log of memoLogs) {
        chargeTransfers.push({
          txHash: log.transactionHash,
          recipient: String(log.args.to).toLowerCase(),
          asset,
          // Fixed 6-decimal text, the shape a charge stores: `formatUnits` would write
          // "100" where every other charge amount reads "100.000000".
          amount: unitsToAmount(log.args.amount ?? 0n),
          memo: memoFromBytes32(log.args.memo),
          // A log only exists in a mined block, so the receipt exists and succeeded.
          confirmed: true,
        });
      }
    }
  }

  // Whatever the pass saw, the classifier decides — once, in one place. Nothing here
  // knows what "paid" means.
  if (chargeTransfers.length > 0) {
    /**
     * The fee leg, read from the SAME receipt the principal was in.
     *
     * A batch is one transaction with two transfers, so the treasury leg is not a
     * separate thing to index — it is a log in a receipt this pass already knows the
     * hash of. One read per transaction, cached for the pass, and a failed read is
     * an empty list rather than an exception: the fee fact fails CLOSED (uncollected)
     * and the payment is still recorded, which is the direction this whole change
     * insists on.
     *
     * `getTokenContract` is per asset because a charge names one token and a batch
     * moves that token; a Transfer log is only a transfer if it came from the
     * contract the charge names.
     */
    const receipts = new Map<string, Promise<TransactionReceipt>>();
    const feeLookup: ChargeFeeLookup = ({ txHash, asset }) => {
      const key = txHash.toLowerCase();
      let receipt = receipts.get(key);
      if (!receipt) {
        receipt = publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        receipts.set(key, receipt);
      }

      return receipt
        .then((found) =>
          feeLegsFromReceipt(found, {
            token: getTokenContract(asset as SupportedAsset, SERVED_NETWORK),
            treasury: treasuryAddressFor(SERVED_NETWORK),
            asset,
          })
        )
        .catch(() => []);
    };

    const decided = await matchChargeTransfers({
      transfers: chargeTransfers,
      network: SERVED_NETWORK,
      chainId: network.chainId,
      feeLookup,
    });

    for (const result of decided) {
      if (result.status) {
        console.log(
          `[charges] ${result.chargeId} → ${result.status} (${result.txHash})`
        );
      } else if (result.code) {
        console.log(`[charges] ${result.chargeId} unchanged: ${result.code} (${result.txHash})`);
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
function logIndexerError(scope: 'indexer' | 'sweep' | 'charges' | 'webhooks', error: unknown): void {
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

    // Charge deadlines and webhook retries, for the same reason: both are periodic
    // states that no request drives. A charge nobody reads still has to expire (its
    // `charge.expired` webhook is owed), and a delivery that failed has to be retried
    // on its backoff even if the merchant never asks again.
    try {
      const expired = await sweepExpiredCharges();

      if (expired.expired.length > 0) {
        console.log(`[charges] expired ${expired.expired.length} of ${expired.checked} due`);
      }
    } catch (error) {
      logIndexerError('charges', error);
    }

    try {
      const deliveries = await deliverDueWebhooks();

      if (deliveries.attempted > 0) {
        console.log(
          `[webhooks] ${deliveries.delivered}/${deliveries.attempted} delivered this tick`
        );
      }
    } catch (error) {
      logIndexerError('webhooks', error);
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
