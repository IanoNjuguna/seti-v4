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
 * What it does, against Moderato:
 *
 *   1. generates a throwaway key,
 *   2. funds it from the testnet faucet (`tempo_fundAddress`),
 *   3. signs ONE transaction carrying the exact shape Seti signs:
 *        transfer(recipient, principal)
 *        transfer(SETI_TREASURY_ADDRESS, fee)
 *   4. decodes both Transfer logs out of the single receipt and asserts they are
 *      there, in the right amounts, to the right addresses.
 *
 * It is a protocol proof, not a payment: no user key, no database, no ledger
 * row. The hash it prints is the anchor `npm run check:send` uses to exercise
 * the happy path of `recordSend` against a real batched receipt.
 *
 * Usage:  npm run prove:batch --workspace backend -- [--asset=ousd|pathusd]
 * Needs:  TEMPO_RPC_URL, TEMPO_TOKEN_PATHUSD, TEMPO_TOKEN_OUSD, SETI_TREASURY_ADDRESS
 *         (defaults to PRIMARY_ASSET — see `TEMPO_ASSET`)
 */
import { http, parseUnits, formatUnits, decodeEventLog, erc20Abi, type Hex } from 'viem';
import { Account, Actions, createClient } from 'viem/tempo';
import { tempoModerato } from 'viem/chains';
import { env } from '../config/env.js';
import { getTokenContract, SUPPORTED_ASSETS, PRIMARY_ASSET, type SupportedAsset } from '../services/chain.js';

/** The principal and 2% fee, mirroring a real quote at the smallest sane size. */
const PRINCIPAL = '0.5';
const FEE = '0.01';

const ASSET_DECIMALS = 6;

/**
 * Which token to prove: `--asset=ousd` or `--asset=pathusd`.
 *
 * Defaults to the app's PRIMARY_ASSET (`TEMPO_ASSET`, `ousd`) — so the proof, the
 * anchors it feeds, and what the app signs are the same asset without anyone
 * having to remember. `--asset=pathusd` still works for a historical comparison.
 */
function resolveAsset(): SupportedAsset {
  const flag = process.argv.find((arg) => arg.startsWith('--asset'));
  const named = flag?.includes('=') ? flag.split('=')[1] : undefined;
  const candidate = named ?? PRIMARY_ASSET;

  if (!SUPPORTED_ASSETS.includes(candidate as SupportedAsset)) {
    throw new Error(
      `--asset must be one of ${SUPPORTED_ASSETS.join(', ')}; received ${candidate}`
    );
  }

  return candidate as SupportedAsset;
}

function log(message: string): void {
  console.log(message);
}

/** A throwaway key: generated here, used for one transaction, never persisted. */
function randomPrivateKey(): Hex {
  return `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
}

async function main(): Promise<void> {
  const asset = resolveAsset();
  const token = getTokenContract(asset);

  if (token.toLowerCase() === env.SETI_TREASURY_ADDRESS.toLowerCase()) {
    throw new Error(`${asset} and SETI_TREASURY_ADDRESS are the same address`);
  }

  const sender = Account.fromSecp256k1(randomPrivateKey());
  const recipient = Account.fromSecp256k1(randomPrivateKey());

  log(`chain:     ${tempoModerato.name} (${tempoModerato.id})`);
  log(`rpc:       ${env.TEMPO_RPC_URL ?? 'default transport'}`);
  log(`asset:     ${asset} (${token})`);
  log(`treasury:  ${env.SETI_TREASURY_ADDRESS}`);
  log(`sender:    ${sender.address}  (throwaway, discarded)`);
  log(`recipient: ${recipient.address}  (throwaway, discarded)`);
  log('');

  const client = createClient({
    account: sender,
    chain: tempoModerato,
    transport: env.TEMPO_RPC_URL ? http(env.TEMPO_RPC_URL) : http(),
  });

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

  const balance = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [sender.address],
  });
  log(`  sender balance: ${formatUnits(balance, ASSET_DECIMALS)} (token units)`);

  if (balance === BigInt(0)) {
    throw new Error('faucet did not fund the sender; nothing to send');
  }

  // The batch, verbatim: the client signs these two calls as ONE transaction.
  const calls = [
    Actions.token.transfer.call({
      token,
      to: recipient.address,
      amount: parseUnits(PRINCIPAL, ASSET_DECIMALS),
    }),
    Actions.token.transfer.call({
      token,
      to: env.SETI_TREASURY_ADDRESS as Hex,
      amount: parseUnits(FEE, ASSET_DECIMALS),
    }),
  ];

  log('');
  log('signing one transaction with two calls…');
  const hash = await client.sendTransaction({ calls } as never);
  log(`  txHash: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({ hash });
  log(`  status: ${receipt.status}  block ${receipt.blockNumber}`);

  if (receipt.status !== 'success') {
    throw new Error('the batched transaction reverted on-chain');
  }

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
  const treasuryLegs = toAddress(env.SETI_TREASURY_ADDRESS);

  const checks: Array<[string, boolean]> = [
    ['the principal leg reached the recipient, once', recipientLegs.length === 1],
    [`and it was ${PRINCIPAL}`, recipientLegs[0]?.value === PRINCIPAL],
    ['the fee leg reached the treasury, once', treasuryLegs.length === 1],
    [`and it was the 2% fee (${FEE})`, treasuryLegs[0]?.value === FEE],
    ['the gas payment did not land on either leg', legs.length === 3],
  ];

  let failures = 0;
  for (const [label, passed] of checks) {
    if (!passed) failures += 1;
    log(`${passed ? 'ok  ' : 'FAIL'}  ${label}`);
  }

  log('');
  log(`ANCHOR  ${hash}`);
  log(
    'use this hash as SEND_CHECK_ANCHOR to exercise `recordSend` against a real\n' +
      'batched receipt (see src/services/send.check.ts)'
  );
  log(failures === 0 ? '\nAll checks passed.' : `\n${failures} CHECK(S) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('prove:batch failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
