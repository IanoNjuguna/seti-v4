/**
 * Derivation checks for the pinned send anchor.
 *
 * `check:send` builds its fixture FROM its pinned receipt (`services/send-anchor.ts`),
 * because a hardcoded fixture is a second copy of the chain and goes stale the
 * moment the anchor changes network. This suite proves that derivation against
 * two independent sets of receipts:
 *
 *  1. SYNTHETIC receipts, one per rule — the largest-transfer rule, the fee and
 *     gas exclusions, a two-leg batch in an unexpected log order, and each
 *     refusal (no transfer at all, no treasury leg, a fee in another token, an
 *     unsupported token).
 *  2. THE REAL PRACTICE ANCHOR — the Moderato batch `check:send` has always
 *     reconciled against — asserting that the derivation reproduces, exactly,
 *     the four facts the suite used to declare in code:
 *
 *        sender    0x57105d4e8c5fD5e868c2B60342580724Ba3fBb92
 *        recipient 0x4111Cc6F2EaE3860e5A4CEF90A42C0572A19e127
 *        principal 0.5
 *        asset     ousd
 *
 *     If that stops holding, `check:send`'s happy path is reconciling a
 *     different transfer than it believes, and this suite says so first.
 *
 * Run with:  npm run check:send-anchor
 * Reads one receipt from the practice RPC by hash; writes nothing anywhere.
 */
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  parseAbiItem,
  type Address,
  type Hex,
} from 'viem';
import { deriveSendAnchor, SendAnchorError, type ReceiptLike } from './send-anchor.js';
import { publicClientFor } from './chain.js';
import { networkConfigFor } from '../config/networks.js';

let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/** The practice network, spelled once for this suite. */
const NETWORK = 'testnet' as const;
const CONFIG = networkConfigFor(NETWORK);
const TREASURY = getAddress(CONFIG.treasuryAddress);
const OUSD = CONFIG.tokens.ousd as Hex;
const PATHUSD = CONFIG.tokens.pathusd as Hex;
/** Tempo's gas sink — every receipt pays its fee here, in the fee token. */
const FEE_RECIPIENT = getAddress('0xfeec000000000000000000000000000000000000');
/** A token the asset table does not know on this chain. */
const FOREIGN_TOKEN = '0x000000000000000000000000000000000000dEaD' as Hex;

const SENDER = getAddress('0x57105d4e8c5fd5e868c2b60342580724ba3fbb92');
const RECIPIENT = getAddress('0x4111cc6f2eae3860e5a4cef90a42c0572a19e127');
const DUST_TARGET = getAddress('0x9a9a0000000000000000000000000000000000ab');

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

/** A Transfer log, built the way a receipt carries one. */
function transfer(
  token: Hex,
  from: Address,
  to: Address,
  value: bigint
): { address: string; data: Hex; topics: readonly Hex[] } {
  return {
    address: token,
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
    topics: encodeEventTopics({
      abi: [transferEvent],
      eventName: 'Transfer',
      args: { from, to },
    }) as readonly Hex[],
  };
}

function receipt(from: Address, logs: ReceiptLike['logs']): ReceiptLike {
  return { from, logs };
}

/** The typed refusal a derivation produced, or a marker for "it did not refuse". */
function problemOf(fn: () => unknown): string {
  try {
    fn();
    return '(did not refuse)';
  } catch (error) {
    return error instanceof SendAnchorError ? error.code : `crash: ${(error as Error).message}`;
  }
}

async function main(): Promise<void> {
  const ONE = 1_000_000n; // 1.000000 in a 6-decimal token
  const PRINCIPAL = 500_000n; // 0.5
  const FEE = 10_000n; // 0.01 (the 2% of 0.5)
  const GAS = 326n;

  console.log(`deriving a send anchor on ${NETWORK} (chain ${CONFIG.chainId})`);
  console.log(`treasury: ${TREASURY}\n`);

  // --- The shape a batch actually has --------------------------------------
  console.log('a two-leg batch:');

  {
    const derived = deriveSendAnchor(
      receipt(SENDER, [
        transfer(OUSD, SENDER, RECIPIENT, PRINCIPAL),
        transfer(OUSD, SENDER, TREASURY, FEE),
        transfer(OUSD, SENDER, FEE_RECIPIENT, GAS),
      ]),
      NETWORK
    );

    check('the signer is the receipt sender', derived.sender === SENDER, derived.sender);
    check('the recipient is the principal leg', derived.recipient === RECIPIENT, derived.recipient);
    check('the principal is the leg amount', derived.principal === '0.5', derived.principal);
    check('the asset resolves from the token address', derived.asset === 'ousd', derived.asset);
    check('the fee leg is read off the receipt', derived.treasuryFee === '0.01', derived.treasuryFee);
  }

  {
    // Log order is a property of execution, not of the product: the gas leg can
    // come first, and a derivation that depended on order would be brittle.
    const derived = deriveSendAnchor(
      receipt(SENDER, [
        transfer(OUSD, SENDER, FEE_RECIPIENT, GAS),
        transfer(OUSD, SENDER, TREASURY, FEE),
        transfer(OUSD, SENDER, RECIPIENT, PRINCIPAL),
      ]),
      NETWORK
    );
    check(
      'log ORDER does not matter: the same fixture comes out',
      derived.recipient === RECIPIENT &&
        derived.principal === '0.5' &&
        derived.treasuryFee === '0.01',
      `${derived.recipient} ${derived.principal} ${derived.treasuryFee}`
    );
  }

  {
    // The largest-transfer rule, made explicit: a dust transfer to a second
    // address must not be mistaken for the principal.
    const derived = deriveSendAnchor(
      receipt(SENDER, [
        transfer(OUSD, SENDER, DUST_TARGET, 1n),
        transfer(OUSD, SENDER, RECIPIENT, PRINCIPAL),
        transfer(OUSD, SENDER, TREASURY, FEE),
      ]),
      NETWORK
    );
    check(
      'the LARGEST payment leg is the principal',
      derived.recipient === RECIPIENT,
      `${derived.recipient} (0x9a9a… was the smaller leg)`
    );
    check('and the dust is not folded into the principal', derived.principal === '0.5', derived.principal);
  }

  // --- What must be refused ------------------------------------------------
  console.log('\nreceipts that cannot anchor a send:');

  check(
    'a receipt with no Transfer log is refused',
    problemOf(() => deriveSendAnchor(receipt(SENDER, []), NETWORK)) === 'no-token-transfer'
  );

  check(
    'a receipt that only pays gas and the fee is refused',
    problemOf(() =>
      deriveSendAnchor(
        receipt(SENDER, [
          transfer(OUSD, SENDER, FEE_RECIPIENT, GAS),
          transfer(OUSD, SENDER, TREASURY, FEE),
        ]),
        NETWORK
      )
    ) === 'no-principal-leg'
  );

  check(
    'a single plain transfer (no treasury leg) is refused',
    problemOf(() =>
      deriveSendAnchor(receipt(SENDER, [transfer(OUSD, SENDER, RECIPIENT, PRINCIPAL)]), NETWORK)
    ) === 'no-treasury-leg'
  );

  check(
    'a fee leg paid in ANOTHER token is not this asset\u2019s fee',
    problemOf(() =>
      deriveSendAnchor(
        receipt(SENDER, [
          transfer(OUSD, SENDER, RECIPIENT, PRINCIPAL),
          transfer(PATHUSD, SENDER, TREASURY, ONE),
        ]),
        NETWORK
      )
    ) === 'no-treasury-leg'
  );

  check(
    'a principal in a token the table does not know is refused',
    problemOf(() =>
      deriveSendAnchor(
        receipt(SENDER, [
          transfer(FOREIGN_TOKEN, SENDER, RECIPIENT, PRINCIPAL),
          transfer(FOREIGN_TOKEN, SENDER, TREASURY, FEE),
        ]),
        NETWORK
      )
    ) === 'unsupported-token'
  );

  // --- The real pinned practice anchor -------------------------------------
  console.log('\nthe real pinned practice anchor (what check:send reconciles):');

  const anchorTx =
    (process.env.TEMPO_TESTNET_SEND_ANCHOR_TX ?? '').trim() ||
    '0xe58f82dfd016ad6d1823dde4183d386bf0c62d59cf4de6706f45b9cab39186f0';

  let chainReceipt;
  try {
    chainReceipt = await publicClientFor(NETWORK).getTransactionReceipt({ hash: anchorTx as Hex });
  } catch (error) {
    console.error(
      `\nThe practice anchor ${anchorTx} could not be read from ${CONFIG.rpcUrl}: ` +
        `${(error as Error).message}\n` +
        'This suite asserts the derivation against a REAL receipt, so it cannot pass without one.'
    );
    process.exit(1);
  }

  const derived = deriveSendAnchor(chainReceipt, NETWORK);

  check(
    'the signer is the address the fixture used to declare',
    derived.sender === SENDER,
    derived.sender
  );
  check(
    'the recipient is the one it used to declare',
    derived.recipient === RECIPIENT,
    derived.recipient
  );
  check('the principal is the one it used to declare', derived.principal === '0.5', derived.principal);
  check('the asset is the one it used to declare', derived.asset === 'ousd', derived.asset);
  check(
    'and the fee leg it read is the 2% of the principal',
    derived.treasuryFee === '0.01',
    derived.treasuryFee
  );
  check(
    'the derived token contract is the network\u2019s OUSD contract',
    derived.assetContract.toLowerCase() === OUSD.toLowerCase(),
    derived.assetContract
  );

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('send-anchor check crashed:', error);
  process.exit(1);
});
