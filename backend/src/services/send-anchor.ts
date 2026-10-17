/**
 * WHAT A PINNED SEND RECEIPT IMPLIES — the fixture, derived from the chain.
 *
 * `check:send` reconciles `recordSend` against ONE real batched receipt read by
 * hash. That receipt is a statement about four facts: who signed it, who was
 * paid, how much moved, and in which token. Those four facts are ON THE RECEIPT,
 * so this module reads them off it instead of declaring them next to it.
 *
 * Why that matters: a hardcoded fixture is a second copy of the chain, and a
 * second copy is wrong the moment the anchor changes network. `check:send` used
 * to declare `sender`/`recipient`/`principal`/`asset` for a Moderato batch, so a
 * real mainnet receipt could not be used without editing constants — which is
 * exactly the edit that turns a proof into a guess. Deriving the fixture means a
 * receipt from ANY served chain can be pinned and reconciled.
 *
 * The rules, and why each is the rule:
 *
 *  - **The signer is `receipt.from`.** A recorded transfer is bound to the wallet
 *    that SIGNED it, so the fixture must own the signer's address and nothing
 *    else. There is no other honest source for it.
 *  - **The principal is the LARGEST transfer that is neither the fee recipient
 *    nor the treasury.** A Tempo receipt carries three kinds of transfer: the
 *    payment legs, the platform fee (to the treasury), and the gas payment (to
 *    the Fee AMM's `0xfeec…0000`). Excluding the last two leaves the legs an
 *    ordinary send produces, and the principal is the big one — a fee is a
 *    percentage of it, so it can never be larger.
 *  - **The asset comes from the winner's token address, through the asset
 *    table.** Token addresses belong to a CHAIN (bridged USDC is a different
 *    contract on each), so the lookup is scoped to the receipt's network. An
 *    address the table does not know under that network is refused rather than
 *    guessed: reconciling a token we do not support would prove the wrong thing.
 *  - **A receipt with no treasury leg is not a batch anchor.** One plain
 *    transfer is the shape the fee-leg guard exists to reject, not a fixture for
 *    the happy path, so it fails here with a typed reason instead of turning
 *    into a confusing reconciliation failure later.
 *
 * Nothing in this module talks to the network or the database: it reads a
 * receipt it is given. That is what lets `send-anchor.check.ts` pin every rule
 * against synthetic receipts as well as against the real pinned one.
 */
import { decodeEventLog, erc20Abi, getAddress, type Hex } from 'viem';
import {
  FEE_AMM_ADDRESS,
  assetForContract,
  formatUnits,
  getTokenContract,
} from './chain.js';
import { treasuryAddressFor } from '../config/networks.js';
import type { Network } from '../lib/network.js';
import type { SupportedAsset } from './chain.js';

/** The reasons a receipt cannot serve as a send anchor. Pinned by the check. */
export type SendAnchorProblem =
  | 'no-token-transfer'
  | 'no-principal-leg'
  | 'unsupported-token'
  | 'no-treasury-leg';

/**
 * A receipt, structurally. Narrower than viem's `TransactionReceipt` on purpose:
 * a check can build one from four fields, and a real receipt satisfies it
 * without a cast.
 */
export interface ReceiptLike {
  from: string;
  logs: readonly {
    address: string;
    data: Hex;
    topics: readonly Hex[];
  }[];
}

/** The four facts the fixture is built from, plus the fee leg they imply. */
export interface DerivedSendAnchor {
  /** `receipt.from` — the address the chain recorded as the signer. */
  sender: `0x${string}`;
  /** The `to` of the largest payment leg. */
  recipient: `0x${string}`;
  /** The principal, formatted in the asset's own units. */
  principal: string;
  /** The same principal, in the token's smallest unit. */
  principalRaw: bigint;
  /** The asset the principal moved in, resolved through the per-chain table. */
  asset: SupportedAsset;
  /** That asset's contract on this network — the address the legs must carry. */
  assetContract: Hex;
  /** The treasury of the network the receipt is on. */
  treasuryAddress: string;
  /** The fee leg's amount, formatted; never null (a missing leg is an error). */
  treasuryFee: string;
}

export class SendAnchorError extends Error {
  readonly code: SendAnchorProblem;

  constructor(code: SendAnchorProblem, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'SendAnchorError';
    this.code = code;
  }
}

/** One Transfer log, decoded, with the token contract that emitted it. */
interface Leg {
  token: Hex;
  to: string;
  value: bigint;
}

/**
 * Every TIP-20 Transfer in the receipt, in log order.
 *
 * Undecodable logs are skipped rather than fatal: a Tempo receipt also carries
 * logs from other contracts, and one of them failing to decode as a Transfer
 * says nothing about the payment.
 */
function transferLegs(receipt: ReceiptLike): Leg[] {
  return receipt.logs.flatMap((entry) => {
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: entry.data,
        topics: entry.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName !== 'Transfer') return [];
      return [
        {
          token: entry.address as Hex,
          to: String(decoded.args.to).toLowerCase(),
          value: decoded.args.value,
        },
      ];
    } catch {
      return [];
    }
  });
}

/**
 * The fixture a receipt implies, or a typed refusal naming what it lacks.
 *
 * `network` is the network the receipt is ON — the caller already knows it,
 * because it read the receipt through that network's client. It is required
 * (no default to the served network) so this can never silently resolve a
 * mainnet receipt against practice token addresses.
 */
export function deriveSendAnchor(receipt: ReceiptLike, network: Network): DerivedSendAnchor {
  const treasury = treasuryAddressFor(network);
  const treasuryLower = treasury.toLowerCase();
  const feeRecipient = FEE_AMM_ADDRESS.toLowerCase();

  const legs = transferLegs(receipt);

  if (legs.length === 0) {
    throw new SendAnchorError(
      'no-token-transfer',
      `The anchor receipt carries no readable TIP-20 Transfer log, so there is no ` +
        `payment to reconcile. This receipt cannot anchor a send on ${network}.`
    );
  }

  // Gas and the platform fee are transfers too. Excluding both is what leaves
  // the payment legs: using the fee recipient as a "recipient" would reconcile
  // against a transfer that is itself a fee, and the treasury leg is the fee.
  const paymentLegs = legs.filter((leg) => leg.to !== feeRecipient && leg.to !== treasuryLower);

  if (paymentLegs.length === 0) {
    throw new SendAnchorError(
      'no-principal-leg',
      `Every transfer in the anchor receipt is to the treasury (${treasury}) or to the gas ` +
        `fee recipient (${FEE_AMM_ADDRESS}), so the receipt carries no payment leg to ` +
        'reconcile against.'
    );
  }

  // The principal is the largest payment leg: a 2% fee is smaller by
  // construction, so this picks the payment rather than any dust beside it.
  const principalLeg = paymentLegs.reduce((largest, leg) => (leg.value > largest.value ? leg : largest));

  const asset = assetForContract(principalLeg.token, network);
  if (!asset) {
    throw new SendAnchorError(
      'unsupported-token',
      `The anchor's principal leg moved token ${principalLeg.token}, which is not one of the ` +
        `assets Seti supports on ${network}. Reconciling it would prove a transfer this ` +
        'product cannot make, so the receipt is refused rather than guessed at.'
    );
  }

  const treasuryLegs = legs.filter(
    (leg) => leg.to === treasuryLower && leg.token.toLowerCase() === principalLeg.token.toLowerCase()
  );

  if (treasuryLegs.length === 0) {
    throw new SendAnchorError(
      'no-treasury-leg',
      `The anchor receipt moved ${formatUnits(principalLeg.value, 6)} ${asset} to ` +
        `${principalLeg.to} but nothing to the ${network} treasury (${treasury}) in the same ` +
        'token. A single-transfer receipt is the shape the fee-leg guard exists to reject, ' +
        'not a fixture for the happy path.'
    );
  }

  const treasuryFeeRaw = treasuryLegs.reduce((sum, leg) => sum + leg.value, BigInt(0));

  return {
    sender: getAddress(receipt.from),
    recipient: getAddress(principalLeg.to),
    principal: formatUnits(principalLeg.value, 6),
    principalRaw: principalLeg.value,
    asset,
    assetContract: getTokenContract(asset, network),
    treasuryAddress: treasury,
    treasuryFee: formatUnits(treasuryFeeRaw, 6),
  };
}
