/**
 * Proves that a batched Tempo transaction lands: ONE transaction, TWO TIP-20
 * transfers, both legs in a single receipt.
 *
 * `docs/internal/fee-routing.md` records this as the one unproven link — "no
 * batched transaction has been signed on Tempo" — and it is the difference
 * between the batch fee path being designed and being real. Everything else
 * about the batch is covered by checks that read real receipts; this is the
 * transaction those checks can only assume.
 *
 * What it does:
 *
 *   1. takes the signer key from `PROVE_BATCH_PRIVATE_KEY` (practice: generates a
 *      throwaway key and funds it from the testnet faucet — there is no faucet on
 *      mainnet),
 *   2. signs ONE transaction carrying the exact shape Seti signs:
 *        transfer(recipient, principal)
 *        transfer(treasury, fee)          fee = 2% of the principal
 *   3. decodes both Transfer logs out of the single receipt and asserts they are
 *      there, in the right amounts, to the right addresses.
 *
 * It is a protocol proof, not a payment: no user key, no database row, no ledger
 * entry. The hash it prints is the anchor `npm run check:send` uses to exercise
 * the happy path of `recordSend` against a real batched receipt.
 *
 * NETWORKS
 * --------
 * Practice (chain 42431) is the default and behaves as it always has: a throwaway
 * key, funded by the faucet. Live (chain 4217) is opt-in twice over:
 *
 *   --network=mainnet --confirm-real-money
 *
 * and it additionally refuses unless `ALLOW_MAINNET` is `"true"`. Without the
 * confirm flag the run is a DRY RUN of the mainnet path: it prints the whole
 * summary — network, chain id, signer and its balance, recipient, principal, fee,
 * treasury, total debit — and sends NOTHING. Nothing here invents a chain, an
 * RPC, a treasury or a token address: every one of them comes from the
 * per-network config (`config/networks.ts`, `config/assets.ts`).
 *
 * THE SIGNER MUST BE FREE
 * -----------------------
 * `check:send` builds its fixture around the anchor's signer and creates a wallet
 * row for `receipt.from`; an address can belong to only one account per network.
 * So a signer that is already a wallet row on this network would make the anchor
 * unusable — and re-using it would spend real money on a proof that cannot be
 * checked. This tool therefore refuses such a signer, and says why. With no key
 * supplied it generates one, prints only its address and the amount to fund, and
 * exits 0 without sending.
 *
 * Usage:
 *   npm run prove:batch -- [--network=mainnet] [--asset=usdt0] [--dry-run] [--confirm-real-money]
 *   npm run prove:batch -- --network=mainnet              # summary only, sends nothing
 *   npm run prove:batch --workspace backend -- [--asset=ousd]
 *
 * Needs:  PROVE_BATCH_PRIVATE_KEY (mainnet always; practice optional),
 *         ALLOW_MAINNET=true (mainnet). Token addresses come from the per-chain
 *         registry (`config/assets.ts`); the TEMPO_TOKEN_* vars only override.
 *         Asset default: USDT0 on mainnet (what the owner's wallet holds), the
 *         app's PRIMARY_ASSET (`TEMPO_ASSET`) on practice.
 */
import { http, parseUnits, formatUnits, decodeEventLog, erc20Abi, type Hex } from 'viem';
import { Account, Actions, createClient } from 'viem/tempo';
import { tempoMainnet, tempoModerato } from 'viem/chains';
import { env } from '../config/env.js';
import {
  PRIMARY_ASSET,
  SUPPORTED_ASSETS,
  getTokenContract,
  networkConfigFor,
  type SupportedAsset,
} from '../services/chain.js';
import type { NetworkConfig } from '../config/networks.js';
import { symbolFor } from '../config/assets.js';
import { getMerchantFeeSchedule } from '../services/fees.js';
import { prisma } from '../lib/prisma.js';
import type { Network } from '../lib/network.js';

/** The principal, mirroring a real quote at the smallest sane size. */
const PRINCIPAL = '0.5';

const ASSET_DECIMALS = 6;

/**
 * The asset a mainnet proof spends by default.
 *
 * USDT0, not OUSD: the owner's funded mainnet wallet holds USDT0, and the point of
 * this run is a real receipt — a principal that cannot be funded proves nothing.
 * Practice keeps the app's PRIMARY_ASSET, so its behaviour is unchanged.
 */
const MAINNET_DEFAULT_ASSET: SupportedAsset = 'usdt0';

/** Where an asset's contract comes from — the ONE per-chain table, never a literal. */
function tokenFor(asset: SupportedAsset, config: NetworkConfig): Hex {
  // `getTokenContract` refuses an asset this chain does not list (USDT0 is
  // mainnet-only), which is better than signing a transfer to an address that
  // holds nothing.
  return getTokenContract(asset, config.network);
}

function log(message: string): void {
  console.log(message);
}

/** A throwaway key: generated here, used for one transaction, never persisted. */
function randomPrivateKey(): Hex {
  return `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
}

/** `--name=value` or `--name value`; undefined when the flag is absent. */
function flagValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const next = process.argv[index + 1];
  return next && !next.startsWith('--') ? next : '';
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

interface Options {
  network: Network;
  asset: SupportedAsset;
  /** `--confirm-real-money`: the only way a mainnet run sends. */
  confirmRealMoney: boolean;
  /** `--dry-run`: print the summary and send nothing, on any network. */
  dryRun: boolean;
}

/**
 * Which network this run is for.
 *
 * Defaults to PRACTICE — the same target as before mainnet mode existed — so a
 * bare `npm run prove:batch` can never spend real money by omission. Mainnet has
 * to be named.
 */
function resolveNetwork(): Network {
  const raw = flagValue('network');
  // Absent means practice — the same target this tool always had, so a bare
  // `npm run prove:batch` cannot spend real money by omission.
  if (raw === undefined) return 'testnet';

  const named = raw.trim().toLowerCase();
  if (named === '') {
    throw new Error('--network needs a value: "--network=mainnet" or "--network=testnet"');
  }
  if (named === 'mainnet' || named === 'testnet') return named;
  throw new Error(`--network must be "mainnet" or "testnet"; received "${named}"`);
}

/**
 * Which token to prove: `--asset=usdt0`, `--asset=ousd`, ...
 *
 * Defaults to USDT0 on mainnet and to the app's PRIMARY_ASSET on practice, so the
 * proof, the anchors it feeds and what the app signs are the same asset without
 * anyone having to remember. An asset the chosen CHAIN does not list is refused
 * here rather than signed against a guessed address.
 */
function resolveAsset(network: Network): SupportedAsset {
  const raw = flagValue('asset');
  const defaultAsset = network === 'mainnet' ? MAINNET_DEFAULT_ASSET : PRIMARY_ASSET;

  if (raw === undefined) return defaultAsset;

  const named = raw.trim().toLowerCase();
  if (named === '') {
    throw new Error(
      `--asset needs a value: one of ${SUPPORTED_ASSETS.join(', ')} ` +
        `(default on ${network}: ${defaultAsset})`
    );
  }

  const candidate = named;
  if (!SUPPORTED_ASSETS.includes(candidate as SupportedAsset)) {
    throw new Error(
      `--asset must be one of ${SUPPORTED_ASSETS.join(', ')}; received ${candidate}`
    );
  }

  const config = networkConfigFor(network);
  if (!config.assets.includes(candidate as SupportedAsset)) {
    throw new Error(
      `${candidate} is not listed on ${config.displayName} (chain ${config.chainId}). ` +
        `This chain lists: ${config.assets.join(', ')}.`
    );
  }

  return candidate as SupportedAsset;
}

function parseOptions(): Options {
  const network = resolveNetwork();
  return {
    network,
    asset: resolveAsset(network),
    confirmRealMoney: hasFlag('confirm-real-money'),
    dryRun: hasFlag('dry-run'),
  };
}

/**
 * viem's chain object for a network — the PROTOCOL definition, not the config.
 *
 * viem's Tempo chain carries the transaction formatters and serializers that make
 * `calls` a real batch; a hand-rolled chain object would silently serialize an
 * empty transaction instead. So the chain object comes from viem and the CHAIN ID
 * is asserted against `config/networks.ts`, which stays the single source of truth:
 * if the two ever disagree, this refuses rather than signing on the wrong chain.
 */
function protocolChainFor(config: NetworkConfig) {
  const chain = config.isMainnet ? tempoMainnet : tempoModerato;
  if (chain.id !== config.chainId) {
    throw new Error(
      `viem's ${chain.name} chain is id ${chain.id} but this deployment's config says ` +
        `${config.chainId} for ${config.network}. Refusing to sign against a chain the ` +
        'config does not agree with.'
    );
  }
  return chain;
}

/** The fee: the schedule's percentage of the principal, in the token's own units. */
function feeFor(principalUnits: bigint): bigint {
  const schedule = getMerchantFeeSchedule();

  // The asset fee is derived from the flat percentage, which is the schedule that
  // ships (2%, no floor, no cap). A floor or cap is a FIAT rule — it needs the
  // exchange rate to resolve — and silently applying only the percentage would
  // under- or over-pay the treasury leg of a REAL transaction. Refuse instead.
  if (schedule.minKes > 0 || schedule.maxPercent > 0) {
    throw new Error(
      'This tool computes the fee leg from the flat percentage only, but the fee schedule ' +
        `has a floor (${schedule.minKes} KES) or a cap (${schedule.maxPercent}%). A fee leg ` +
        'that big cannot be derived from the principal in the token alone, and guessing it ' +
        'would misprice a real transfer. Set MERCHANT_FEE_MIN_KES=0 and ' +
        'MERCHANT_FEE_MAX_PERCENT=0, or price the batch through the app.'
    );
  }

  // Integer arithmetic on the token's smallest unit, so the leg can never carry
  // float dust (0.5 * 2% must be exactly 0.01, not 0.009999999…).
  const basisPoints = BigInt(Math.round(schedule.percent * 100));
  return (principalUnits * basisPoints) / BigInt(10_000);
}

interface Summary {
  config: NetworkConfig;
  asset: SupportedAsset;
  token: Hex;
  treasury: string;
  sender: string;
  balanceUnits: bigint;
  recipient: string;
  principalUnits: bigint;
  feeUnits: bigint;
  totalUnits: bigint;
  feePercent: number;
  dryRun: boolean;
}

/**
 * Everything a person needs to know BEFORE real money moves, printed to stdout.
 *
 * In dry-run mode every line is prefixed `DRY RUN`, so a copied log can never be
 * mistaken for a run that happened.
 */
function printSummary(summary: Summary): void {
  const prefix = summary.dryRun ? 'DRY RUN  ' : '';
  const unit = symbolFor(summary.asset);
  const amount = (units: bigint) => `${formatUnits(units, ASSET_DECIMALS)} ${unit}`;

  log('');
  log(`${prefix}network:      ${summary.config.displayName} (${summary.config.network}, chain ${summary.config.chainId})`);
  log(`${prefix}rpc:          ${summary.config.rpcUrl}`);
  log(`${prefix}asset:        ${summary.asset} (${summary.token}, ${ASSET_DECIMALS} decimals)`);
  log(`${prefix}treasury:     ${summary.treasury}  (the fee leg pays this address)`);
  log(`${prefix}signer:       ${summary.sender}`);
  log(`${prefix}  balance:    ${amount(summary.balanceUnits)}`);
  log(`${prefix}recipient:    ${summary.recipient}  (fresh, never reused)`);
  log(`${prefix}principal:    ${amount(summary.principalUnits)}`);
  log(`${prefix}fee:          ${amount(summary.feeUnits)}  (${summary.feePercent}% of the principal)`);
  log(`${prefix}total debit:  ${amount(summary.totalUnits)}  (principal + fee; gas is charged in the same token on top)`);
  log('');
}

async function main(): Promise<void> {
  const options = parseOptions();
  const config = networkConfigFor(options.network);
  const asset = options.asset;
  const token = tokenFor(asset, config);
  const treasury = config.treasuryAddress;

  if (token.toLowerCase() === treasury.toLowerCase()) {
    throw new Error(`${asset} and the ${config.network} treasury are the same address`);
  }

  const principalUnits = parseUnits(PRINCIPAL, ASSET_DECIMALS);
  const feeUnits = feeFor(principalUnits);
  const totalUnits = principalUnits + feeUnits;
  const schedule = getMerchantFeeSchedule();

  // The signer. On mainnet the key must be supplied — there is no faucet, and a
  // tool that spends real money must never invent a key and quietly move funds.
  const suppliedKey = (process.env.PROVE_BATCH_PRIVATE_KEY ?? '').trim();

  if (!suppliedKey && config.isMainnet) {
    const fresh = Account.fromSecp256k1(randomPrivateKey());
    log(
      'No PROVE_BATCH_PRIVATE_KEY is set. A fresh mainnet signer was generated, and NOTHING\n' +
        'was sent — mainnet has no faucet, so this key has to be funded first.'
    );
    log('');
    log(`  address: ${fresh.address}`);
    log(
      `  fund:    ${formatUnits(totalUnits, ASSET_DECIMALS)} ${symbolFor(asset)} on chain ` +
        `${config.chainId} (principal ${formatUnits(principalUnits, ASSET_DECIMALS)} + fee ` +
        `${formatUnits(feeUnits, ASSET_DECIMALS)}; gas is charged in the same token on top)`
    );
    log('');
    log('Set PROVE_BATCH_PRIVATE_KEY to that key and run the same command again.');
    return;
  }

  const sender = Account.fromSecp256k1(suppliedKey ? (suppliedKey as Hex) : randomPrivateKey());
  const recipient = Account.fromSecp256k1(randomPrivateKey());

  // A signer that is already a wallet row cannot anchor a check: `check:send`
  // declares `receipt.from` as a wallet of its own account, and an address belongs
  // to one account per network. Refusing here is what keeps a REAL spend from
  // producing a receipt nothing can reconcile.
  if (config.isMainnet) {
    const taken = await prisma.wallet.findFirst({
      where: { address: { equals: sender.address, mode: 'insensitive' }, network: config.network },
    });

    if (taken) {
      await prisma.$disconnect();
      throw new Error(
        `The signer ${sender.address} is already a wallet row on ${config.network} ` +
          `(account ${taken.userId}).\n` +
          'check:send registers the anchor signer as a wallet of its own fixture account, and an\n' +
          'address can belong to only one account per network — so a receipt signed by this key\n' +
          'could not be reconciled, and the real money it spent would buy nothing provable.\n' +
          'Use a fresh PROVE_BATCH_PRIVATE_KEY (unset it to generate one and see its address).'
      );
    }
  }

  const client = createClient({
    account: sender,
    chain: protocolChainFor(config),
    transport: http(config.rpcUrl),
    // The fee token is the asset being spent, which is what the app signs: gas is
    // then charged in that token, so the receipt carries exactly three transfers
    // (principal, fee, gas) and the gas leg is measurable by the checks.
    feeToken: token,
  });

  log(`proving a batch on ${config.displayName} (chain ${config.chainId})…`);

  if (!config.isMainnet) {
    log('');
    log('funding the sender from the testnet faucet…');
    const fundingHashes = await client.request({
      method: 'tempo_fundAddress',
      params: [sender.address],
    } as never);
    const mints: Hex[] = Array.isArray(fundingHashes) ? (fundingHashes as Hex[]) : [];
    log(`  faucet returned ${mints.length} mint(s)`);

    // The faucet answers with hashes, not with balances: the mints are ordinary
    // transactions and need a block. Reading the balance immediately after the
    // response reads zero and looks like a dead faucet.
    await Promise.all(
      mints.map((mint) =>
        client
          .waitForTransactionReceipt({ hash: mint, timeout: 60_000 })
          .then((receipt) => log(`  mint ${mint.slice(0, 12)}… ${receipt.status}`))
          .catch((error: unknown) =>
            log(`  mint ${mint.slice(0, 12)}… not confirmed: ${(error as Error).message.slice(0, 60)}`)
          )
      )
    );
  }

  const balanceUnits = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [sender.address],
  });

  // Mainnet sends only when BOTH flags are present; anything else is a dry run
  // that prints the same summary and spends nothing.
  const dryRun = options.dryRun || (config.isMainnet && !options.confirmRealMoney);

  printSummary({
    config,
    asset,
    token,
    treasury,
    sender: sender.address,
    balanceUnits,
    recipient: recipient.address,
    principalUnits,
    feeUnits,
    totalUnits,
    feePercent: schedule.percent,
    dryRun,
  });

  // --- The mainnet gates, in order -----------------------------------------
  if (config.isMainnet) {
    if (env.ALLOW_MAINNET !== 'true') {
      await prisma.$disconnect();
      throw new Error(
        'REFUSED: ALLOW_MAINNET is not "true", so this process may not touch mainnet at all.\n' +
          `A confirmed run WOULD sign one transaction on chain ${config.chainId} spending ` +
          `${formatUnits(totalUnits, ASSET_DECIMALS)} ${symbolFor(asset)} of REAL money from ` +
          `${sender.address}: ${formatUnits(principalUnits, ASSET_DECIMALS)} ${symbolFor(asset)} ` +
          `to ${recipient.address} and ${formatUnits(feeUnits, ASSET_DECIMALS)} ${symbolFor(asset)} ` +
          `to the treasury ${treasury}. NOTHING WAS SENT.\n` +
          'Set ALLOW_MAINNET=true deliberately if this deployment is meant to operate on mainnet.'
      );
    }

    // `--dry-run` is the explicit "show me, send nothing" path: it needs no
    // confirmation, because there is nothing to confirm.
    if (!options.confirmRealMoney && !options.dryRun) {
      await prisma.$disconnect();
      throw new Error(
        'REFUSED: --network=mainnet requires --confirm-real-money.\n' +
          `A confirmed run WOULD sign one transaction on chain ${config.chainId} spending ` +
          `${formatUnits(totalUnits, ASSET_DECIMALS)} ${symbolFor(asset)} of REAL money from ` +
          `${sender.address}: ${formatUnits(principalUnits, ASSET_DECIMALS)} ${symbolFor(asset)} ` +
          `to ${recipient.address} and ${formatUnits(feeUnits, ASSET_DECIMALS)} ${symbolFor(asset)} ` +
          `to the treasury ${treasury}. NOTHING WAS SENT.\n` +
          'Re-run with --confirm-real-money to send it, or with --dry-run to print this ' +
          'summary and stop.'
      );
    }
  }

  if (dryRun) {
    log('DRY RUN  nothing was signed and nothing was sent.');
    await prisma.$disconnect();
    return;
  }

  if (balanceUnits < totalUnits) {
    await prisma.$disconnect();
    throw new Error(
      `${sender.address} holds ${formatUnits(balanceUnits, ASSET_DECIMALS)} ${symbolFor(asset)} ` +
        `on chain ${config.chainId}, but the batch needs ${formatUnits(totalUnits, ASSET_DECIMALS)} ` +
        `(${formatUnits(principalUnits, ASSET_DECIMALS)} principal + ` +
        `${formatUnits(feeUnits, ASSET_DECIMALS)} fee) plus gas. Fund it and run again.`
    );
  }

  // The batch, verbatim: the client signs these two calls as ONE transaction,
  // through the Tempo protocol path (`calls`), never an EIP-1193 transfer — a
  // generic provider would drop `calls` and send an empty transaction.
  const calls = [
    Actions.token.transfer.call({
      token,
      to: recipient.address,
      amount: principalUnits,
    }),
    Actions.token.transfer.call({
      token,
      to: treasury as Hex,
      amount: feeUnits,
    }),
  ];

  log('signing one transaction with two calls…');
  const hash = await client.sendTransaction({ calls } as never);
  log(`  txHash: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({ hash });
  log(`  status: ${receipt.status}  block ${receipt.blockNumber}`);

  if (receipt.status !== 'success') {
    throw new Error('the batched transaction reverted on-chain');
  }

  // Printed BEFORE the assertions: if one of them fails, the operator still has
  // the hash and the line to pin, and a real transaction is never left unrecorded.
  const principalLabel = formatUnits(principalUnits, ASSET_DECIMALS);
  const feeLabel = formatUnits(feeUnits, ASSET_DECIMALS);

  log('');
  log(`ANCHOR  ${hash}`);
  log(
    `pin it for the check suite that reconciles sends on this network:\n` +
      `  TEMPO_${config.network.toUpperCase()}_SEND_ANCHOR_TX=${hash}`
  );

  // Both legs, out of the ONE receipt. This is the assertion the whole batch fee
  // path rests on: two transfers, one transaction, no partial state possible.
  const legs = receipt.logs
    .filter((entry) => entry.address.toLowerCase() === token.toLowerCase())
    .flatMap((entry) => {
      try {
        const decoded = decodeEventLog({ abi: erc20Abi, data: entry.data, topics: entry.topics });
        if (decoded.eventName !== 'Transfer') return [];
        return [
          {
            to: String(decoded.args.to),
            value: formatUnits(decoded.args.value, ASSET_DECIMALS),
          },
        ];
      } catch {
        return [];
      }
    });

  log('');
  log('transfers found in the single receipt:');
  for (const leg of legs) log(`  -> ${leg.to}  ${leg.value}`);

  // A Tempo transaction pays its own gas in a stablecoin, and that payment is
  // itself a Transfer — to the fee-recipient address (0xfeEC…), converted by the
  // Fee AMM. It is not a payment leg, which is exactly why reconciliation in
  // `recordPayment`/`recordSend` looks for a Transfer to a KNOWN address instead
  // of counting transfers.
  const toAddress = (address: string) =>
    legs.filter((leg) => leg.to.toLowerCase() === address.toLowerCase());
  const recipientLegs = toAddress(recipient.address);
  const treasuryLegs = toAddress(treasury);

  const checks: Array<[string, boolean]> = [
    ['the principal leg reached the recipient, once', recipientLegs.length === 1],
    [`and it was ${principalLabel}`, recipientLegs[0]?.value === principalLabel],
    ['the fee leg reached the treasury, once', treasuryLegs.length === 1],
    [`and it was the ${schedule.percent}% fee (${feeLabel})`, treasuryLegs[0]?.value === feeLabel],
    ['the gas payment did not land on either leg', legs.length === 3],
  ];

  let failures = 0;
  for (const [label, passed] of checks) {
    if (!passed) failures += 1;
    log(`${passed ? 'ok  ' : 'FAIL'}  ${label}`);
  }

  log('');
  log(
    failures === 0
      ? `All checks passed. ${config.network} anchor: TEMPO_${config.network.toUpperCase()}_SEND_ANCHOR_TX=${hash}`
      : `${failures} CHECK(S) FAILED — the transaction landed, but the receipt does not read as ` +
        'a two-leg batch. Do not pin it.'
  );

  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('prove:batch failed:', error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
