import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { describeEvmAddress } from '../lib/address.js';
import type { TransactionType } from '../types/index.js';
import { SEND_REQUIRES_BATCH } from './payments.js';
import { QuoteError, readQuote, type FrozenRate } from './quote.js';
import { calculateMerchantFee, splitFeeInclusiveTotal } from './fees.js';
import { logAuditEvent } from './audit.js';
import {
  refusal,
  type ReceiptFailureCode,
} from './payment-refusal.js';
import {
  assetDecimals,
  formatUnits,
  getTokenContract,
  publicClient,
  waitForTransactionReceipt,
  type SupportedAsset,
} from './chain.js';
import { decodeEventLog, erc20Abi, type Hex, type TransactionReceipt } from 'viem';

interface CreateTransactionInput {
  userId: string;
  amount: string;
  asset: string;
  counterparty: string;
  type: TransactionType;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface RecordPaymentInput {
  userId: string;
  /**
   * Total amount the customer actually transferred, INCLUDING the merchant
   * fee. This is the figure that left the customer's wallet, so the backend
   * derives the principal and the fee from it rather than trusting a
   * client-supplied breakdown.
   */
  amount: string;
  asset: string;
  merchantId: string;
  txHash: string;
  /**
   * The signed rate quote from the preview the customer confirmed. Every fiat
   * figure this call writes is derived from the rate inside it. A missing,
   * forged, expired or foreign quote refuses — never a live re-read.
   */
  quoteId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}


interface RecordSendInput {
  userId: string;
  /**
   * The principal the customer claims the recipient received, in the asset's own
   * units. Never the gross: in `batch` mode the fee is a separate leg, so what
   * left the wallet is principal + fee and the chain is asked about the
   * principal specifically.
   */
  amount: string;
  asset: string;
  /** The address the money was sent to, as the customer typed it. */
  recipient: string;
  txHash: string;
  /**
   * The signed rate quote from the preview the customer confirmed. Same contract
   * as `RecordPaymentInput.quoteId`: the frozen rate is the only rate written.
   */
  quoteId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Rounds to 2dp, avoiding float dust like 10.000000000000002. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolve the frozen rate a record path must write, or refuse.
 *
 * This is the ONLY source of a rate on the record path. There is deliberately no
 * `getFxQuote` fallback: a record that cannot present a valid quote refuses
 * rather than pricing the row at a rate the customer never saw — that fallback
 * is the bug this whole mechanism exists to close.
 *
 * Failures map straight onto the client-facing refusal codes (`quote-missing`,
 * `quote-invalid`, `quote-expired`, `quote-not-yours`), recorded in `audit_logs`
 * against the txHash like every other refusal.
 */
async function resolveFrozenRate(input: {
  quoteId?: string;
  userId: string;
  txHash: string;
  merchantId?: string;
}): Promise<FrozenRate> {
  try {
    return readQuote(input.quoteId, input.userId);
  } catch (error) {
    if (error instanceof QuoteError) {
      throw await refusal({
        userId: input.userId,
        txHash: input.txHash,
        ...(input.merchantId ? { merchantId: input.merchantId } : {}),
        code: error.code,
        reason: error.message,
      });
    }
    throw error;
  }
}

/**
 * The user's active wallet — the ADDRESS their money moves from.
 *
 * Deliberately NOT filtered by asset, and that is the fix for a real refusal
 * (`No active pathusd wallet found for user`). Registration labels the row with
 * one asset (`ousd`, from the login path), while the money path operates in
 * `pathusd` — but the two are the same Tempo address: a TIP-20 balance belongs
 * to the address, not to the row, and `Wallet.address` is globally unique, so
 * there is exactly one row per address and it cannot name both tokens.
 *
 * Filtering on the asset therefore refused every transfer the user could
 * actually make, after the money had already left the wallet. The asset is a
 * property of the TRANSFER (`Transaction.asset`, and the amount verified against
 * the receipt), never of the wallet. `getHomeDashboard` already looks the wallet
 * up this way; this function was the only place that disagreed, which is how the
 * bug survived.
 */
async function findActiveWallet(userId: string) {
  const wallet = await prisma.wallet.findFirst({
    where: { userId, status: 'active' },
  });

  if (!wallet) {
    throw new Error(
      'No active wallet found for this account. Sign in again so the embedded wallet is registered.'
    );
  }

  return wallet;
}

/**
 * The other half of a transfer: the row the RECIPIENT sees.
 *
 * A transfer between two Seti accounts is one on-chain transaction and two
 * movements of money, but it produced a single ledger row — the sender's — because
 * `txHash` was globally unique and whoever recorded first owned it. The person who
 * received the money therefore saw an empty Activity while the sender's balance
 * changed. This writes their side: the PRINCIPAL they were paid, never the fee,
 * which went to the treasury and is already on the sender's row.
 *
 * Written in the same request as the sender's row, from the same receipt and the
 * same fx quote, so the two sides cannot disagree about what moved or what it was
 * worth. Returns null when the recipient is not a Seti account — an external
 * address has no ledger to write to.
 */
export async function receivedSide(input: {
  recipient: string;
  /** The principal leg, as read from the receipt. */
  amountAsset: number;
  amountFiat: number;
  asset: string;
  txHash: string;
  senderAddress: string;
  quote: { fiatCurrency: string; fiatPerUsd: number; source: string; asOf: Date };
}) {
  // Case-insensitive: an address is stored in whatever casing registered it, and a
  // mismatch here would silently mean "not a Seti account" and lose the row.
  const recipientWallet = await prisma.wallet.findFirst({
    where: { address: { equals: input.recipient, mode: 'insensitive' } },
  });

  if (!recipientWallet) return null;

  const existing = await prisma.transaction.findFirst({
    where: { txHash: input.txHash, userId: recipientWallet.userId },
  });

  if (existing) return existing;

  return prisma.transaction.create({
    data: {
      userId: recipientWallet.userId,
      walletId: recipientWallet.id,
      type: 'p2p_receive',
      // Already on chain — this row is written from a confirmed receipt, so it
      // needs no confirmation pass of its own.
      status: 'completed',
      amount: input.amountAsset.toFixed(8),
      asset: input.asset,
      counterparty: input.senderAddress,
      txHash: input.txHash,
      fiatAmount: input.amountFiat.toFixed(2),
      fiatCurrency: input.quote.fiatCurrency,
      fxRate: input.quote.fiatPerUsd.toFixed(8),
      fxRateSource: input.quote.source,
      fxRateAsOf: input.quote.asOf,
      settledAt: new Date(),
      metadata: {
        derived: { from: 'send.recorded', senderAddress: input.senderAddress },
      } as never,
    },
  });
}

export async function createTransaction(input: CreateTransactionInput) {
  const wallet = await findActiveWallet(input.userId);

  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      walletId: wallet.id,
      type: input.type,
      status: 'pending',
      amount: input.amount,
      asset: input.asset,
      counterparty: input.counterparty,
      description: input.description,
      // Namespaced for the same reason as recordPayment: this row is evidence,
      // and caller-supplied keys must not sit level with derived ones.
      metadata: { client: input.metadata ?? {} } as never,
    },
  });

  // No off-ramp exists in v1: no Stripe, no Bridge, no KES bank settlement, and
  // `BRIDGE_API_KEY` has no call site. See docs/internal/prd.md §7 — this is the
  // first place an off-ramp call would go, and there is nothing above it yet.
  // For the scaffold, leave status as pending.

  return transaction;
}

/**
 * Reads the amount that actually moved, out of an on-chain receipt.
 *
 * The client tells us how much it thinks it sent; this is what the chain
 * recorded. Returns the Transfer `value` for the expected recipient so the
 * caller can compare rather than trust.
 */
async function readTransferredAmount(
  txHash: string,
  tokenAddress: Hex,
  expectedRecipient: string,
  asset: SupportedAsset
): Promise<
  | { ok: true; value: number }
  | { ok: false; code: ReceiptFailureCode; reason: string }
> {
  let receipt: TransactionReceipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash as Hex });
  } catch {
    return { ok: false, code: 'receipt-unavailable', reason: 'receipt not available yet' };
  }

  if (receipt.status !== 'success') {
    return { ok: false, code: 'receipt-reverted', reason: 'transaction reverted on-chain' };
  }

  const token = tokenAddress.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== token) continue;
    try {
      const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (decoded.eventName !== 'Transfer') continue;

      const to = String(decoded.args.to).toLowerCase();
      if (to !== expectedRecipient.toLowerCase()) continue;

      return {
        ok: true,
        value: Number(formatUnits(decoded.args.value, assetDecimals[asset])),
      };
    } catch {
      // Not a Transfer log we can decode; keep looking.
    }
  }

  return {
    ok: false,
    code: 'transfer-not-found',
    reason: `no ${asset} Transfer to ${expectedRecipient} found in receipt`,
  };
}

/**
 * Records a payment that has already been signed and broadcast on-chain.
 *
 * What `input.amount` means depends on the server-side FEE_ROUTING_MODE:
 *
 *  - `inside-transfer`: the customer signed ONE transfer of principal + fee to
 *    the merchant, so `input.amount` is the GROSS and there is no treasury leg.
 *    The fee is recorded but not collected — Seti retains nothing.
 *  - `batch`: the customer signed an atomic batch of two transfers — principal
 *    to the merchant, fee to the treasury — so `input.amount` is the PRINCIPAL
 *    and the gross is derived. Both legs must be present on-chain or the payment
 *    is refused.
 *
 * Either way the figure the client supplies is an input, not a measurement, so
 * it is verified against the chain before anything is written: on mainnet,
 * trusting it would let a modified client under-report the amount and therefore
 * the merchant fee at will.
 */
export async function recordPayment(input: RecordPaymentInput) {
  // The wallet lookup is caught rather than left to throw: a user with no
  // active wallet is a refusal like any other, and it has to be recorded with
  // the txHash so support can find it. Without this it is the one failure on
  // this path that leaves no trace at all.
  const [walletResult, merchant] = await Promise.all([
    findActiveWallet(input.userId).catch((error: unknown) => error as Error),
    prisma.merchant.findUnique({ where: { id: input.merchantId } }),
  ]);

  if (walletResult instanceof Error) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: 'no-active-wallet',
      reason: walletResult.message,
    });
  }
  const wallet = walletResult;

  if (!merchant) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: 'merchant-not-found',
      reason: 'Merchant not found',
    });
  }

  // A merchant with no on-chain address cannot have received a transfer, so
  // there is nothing to reconcile against. This used to skip verification
  // entirely and record the client's claimed figures as settled — the exact
  // under-reporting path reconciliation exists to close.
  if (!merchant.payoutAddress) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      merchantId: merchant.id,
      code: 'merchant-no-payout-address',
      reason:
        'Merchant has no payout address, so the payment cannot be verified on-chain. ' +
        'Set a payout address before accepting payments.',
    });
  }

  const asset = input.asset as SupportedAsset;
  const claimedAmount = Number(input.amount);

  if (!Number.isFinite(claimedAmount) || claimedAmount <= 0) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      merchantId: merchant.id,
      code: 'amount-invalid',
      reason: 'Amount must be a positive number',
      claimedAmount,
    });
  }

  // The rate is FROZEN at quote time. Resolve the signed quote the client
  // presented — or refuse. Reading a live rate here instead is precisely the
  // "the figure shown differs from the figure recorded" bug this closes.
  const quote = await resolveFrozenRate({
    quoteId: input.quoteId,
    userId: input.userId,
    txHash: input.txHash,
    merchantId: merchant.id,
  });

  const batchMode = env.FEE_ROUTING_MODE === 'batch';

  // The merchant leg. In batch mode this is the PRINCIPAL; in inside-transfer
  // mode it is the GROSS. Either way the chain is authoritative.
  const merchantLeg = await readTransferredAmount(
    input.txHash,
    getTokenContract(asset),
    merchant.payoutAddress,
    asset
  );

  if (!merchantLeg.ok) {
    // Fail closed: on mainnet an unverifiable payment must not be written as a
    // settled one.
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      merchantId: merchant.id,
      code: merchantLeg.code,
      reason: `Payment could not be verified on-chain: ${merchantLeg.reason}`,
      claimedAmount,
    });
  }

  // One percent tolerance absorbs rounding in the client's preview without
  // letting a materially different amount through.
  const tolerance = claimedAmount * 0.01;
  if (Math.abs(merchantLeg.value - claimedAmount) > tolerance) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      merchantId: merchant.id,
      code: 'amount-mismatch',
      reason:
        `Payment amount mismatch: client claimed ${claimedAmount} ${asset}, ` +
        `chain recorded ${merchantLeg.value} ${asset}`,
      claimedAmount,
      observedAmount: merchantLeg.value,
    });
  }

  // The chain is authoritative: derive every figure from what actually moved.
  const observedPrincipal = merchantLeg.value;
  let treasuryFeeObserved: number | null = null;

  if (batchMode) {
    // The fee must have actually reached the treasury. Without this check a
    // client could send only the principal leg and still be recorded as having
    // paid a fee — the batch would be atomic on-chain but unverified here,
    // which is the same uncollected-fee problem in a new shape.
    const treasuryLeg = await readTransferredAmount(
      input.txHash,
      getTokenContract(asset),
      env.SETI_TREASURY_ADDRESS,
      asset
    );

    if (!treasuryLeg.ok) {
      throw await refusal({
        userId: input.userId,
        txHash: input.txHash,
        merchantId: merchant.id,
        code: 'fee-leg-unverified',
        reason:
          `Fee leg could not be verified on-chain: ${treasuryLeg.reason}. ` +
          'The payment is only valid when the batch moved both the merchant ' +
          'principal and the fee to the treasury.',
        claimedAmount,
        observedAmount: observedPrincipal,
      });
    }

    treasuryFeeObserved = treasuryLeg.value;
  }

  // In inside-transfer mode the merchant leg IS the gross, so the principal is
  // recovered by inverting the schedule. In batch mode the merchant leg is
  // already the principal, and the gross is principal + fee.
  let reconciledGross: number;
  let principalFiat: number;
  let feeFiat: number;

  if (batchMode) {
    // Derive the principal in KES from the observed merchant leg, and define
    // the fee as the residue of the gross so `gross == principal + fee` holds
    // exactly with no rounding residue.
    const grossUsd = observedPrincipal + (treasuryFeeObserved ?? 0);
    reconciledGross = grossUsd;
    principalFiat = round2(observedPrincipal * quote.fiatPerUsd);
    feeFiat = round2(grossUsd * quote.fiatPerUsd - principalFiat);
  } else {
    reconciledGross = observedPrincipal;
    const grossFiat = round2(reconciledGross * quote.fiatPerUsd);
    const split = splitFeeInclusiveTotal(grossFiat);
    principalFiat = round2(split.principalFiat);
    feeFiat = round2(grossFiat - principalFiat);
  }

  const fiatAmount = round2(principalFiat);
  const merchantNet = round2(principalFiat);

  // Recomputed only to report whether a cap governed; it does not set the fee.
  const feeResult = calculateMerchantFee(fiatAmount);

  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      walletId: wallet.id,
      type: 'payment',
      status: 'processing',
      amount: reconciledGross.toFixed(8),
      asset: input.asset,
      counterparty: merchant.payoutAddress,
      merchantId: merchant.id,
      txHash: input.txHash,
      fiatAmount: fiatAmount.toFixed(2),
      fiatCurrency: quote.fiatCurrency,
      feeAmount: feeFiat.toFixed(2),
      feeUncappedAmount: feeResult.uncappedFeeKes.toFixed(2),
      feeCapped: feeResult.cappedByMaxPercent,
      merchantNetAmount: merchantNet.toFixed(2),
      fxRate: quote.fiatPerUsd.toFixed(8),
      fxRateSource: quote.source,
      fxRateAsOf: quote.asOf,
      description: input.description,
      metadata: {
        // The caller's blob is namespaced. This row is audit evidence, and a
        // flat blob the client can write into is not evidence: it must be
        // impossible to mistake a client-supplied claim for a value the
        // backend derived. Server-derived keys stay at the top level.
        client: input.metadata ?? {},
        feeRoutingMode: batchMode ? 'batch' : 'inside-transfer',
        ...(batchMode
          ? { treasuryFeeObserved: treasuryFeeObserved?.toFixed(8) }
          : {}),
      } as never,
    },
  });

  await logAuditEvent({
    userId: input.userId,
    action: 'payment.recorded',
    txHash: input.txHash,
    metadata: {
      merchantId: merchant.id,
      feeRoutingMode: batchMode ? 'batch' : 'inside-transfer',
      gross: reconciledGross,
      fiatAmount,
      feeFiat,
      feeCapped: feeResult.cappedByMaxPercent,
      merchantNet,
      fxRate: quote.fiatPerUsd,
      fxRateSource: quote.source,
      ...(batchMode ? { treasuryFeeObserved } : {}),
    },
  });

  // The MERCHANT's side of the same payment, when the merchant is a Seti account.
  //
  // A payment to a merchant and a send to a person are the same two-leg batch, so the
  // merchant's ledger needs the counterpart row that a send already writes for its
  // recipient (`receivedSide`). Without it, a merchant who is also a Seti user saw
  // NOTHING in their own Activity for money they had been paid — which is the one view
  // of their takings they have.
  //
  // The row carries the PRINCIPAL the chain paid them, never the fee: that went to the
  // treasury and is already recorded on the payer's row. A merchant whose payout
  // address is not a Seti wallet gets nothing here, which is correct — an external
  // address has no ledger to write to.
  await receivedSide({
    recipient: merchant.payoutAddress,
    amountAsset: observedPrincipal,
    amountFiat: principalFiat,
    asset: input.asset,
    txHash: input.txHash,
    senderAddress: wallet.address,
    quote,
  });

  return transaction;
}

/**
 * Records a send to a person that has already been signed and broadcast.
 *
 * The shape of a send, in `batch` mode:
 *
 *   transfer(recipient, principal)   — what the person receives
 *   transfer(treasury,  fee)         — the 2%, actually collected
 *
 * one atomic transaction, so a send cannot land with the fee missing. Even so,
 * both legs are re-read from the receipt here: "atomic on chain" and "verified
 * against the chain" are different claims, and only the second one is allowed to
 * write a row. This is the same rule `recordPayment` follows, and the reason the
 * batch is load-bearing rather than merely reassuring.
 *
 * Refused outside `batch` mode — with no merchant in the path there is no
 * recipient for the fee, so a single transfer would pay the 2% to the person
 * being sent to. See {@link SEND_REQUIRES_BATCH}.
 */
export async function recordSend(input: RecordSendInput) {
  const walletResult = await findActiveWallet(input.userId).catch(
    (error: unknown) => error as Error
  );

  if (walletResult instanceof Error) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: 'no-active-wallet',
      reason: walletResult.message,
    });
  }
  const wallet = walletResult;

  const complaint = describeEvmAddress(input.recipient);
  if (complaint) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: 'recipient-invalid',
      reason: complaint,
    });
  }
  const recipient = input.recipient;

  // A transfer to the sender's own active wallet moves nothing and still costs
  // gas — and in batch mode it would pay the fee twice for nothing. Refused
  // rather than recorded, so the ledger never shows a send that was a no-op.
  if (wallet.address.toLowerCase() === recipient.toLowerCase()) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: 'recipient-is-self',
      reason: 'That is your own wallet address, so the transfer would move nothing.',
    });
  }

  if (env.FEE_ROUTING_MODE !== 'batch') {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: 'send-requires-batch',
      reason: SEND_REQUIRES_BATCH,
    });
  }

  const asset = input.asset as SupportedAsset;
  const claimedAmount = Number(input.amount);

  if (!Number.isFinite(claimedAmount) || claimedAmount <= 0) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: 'amount-invalid',
      reason: 'Amount must be a positive number',
      claimedAmount,
    });
  }

  // The rate is FROZEN at quote time — resolve the signed quote or refuse. Same
  // rule as `recordPayment`: there is no live-rate fallback on this path.
  const quote = await resolveFrozenRate({
    quoteId: input.quoteId,
    userId: input.userId,
    txHash: input.txHash,
  });

  // The recipient's leg. The chain is authoritative; the claim is only an input.
  const recipientLeg = await readTransferredAmount(
    input.txHash,
    getTokenContract(asset),
    recipient,
    asset
  );

  if (!recipientLeg.ok) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: recipientLeg.code,
      reason: `Send could not be verified on-chain: ${recipientLeg.reason}`,
      claimedAmount,
    });
  }

  const tolerance = claimedAmount * 0.01;
  if (Math.abs(recipientLeg.value - claimedAmount) > tolerance) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: 'amount-mismatch',
      reason:
        `Send amount mismatch: client claimed ${claimedAmount} ${asset}, ` +
        `chain recorded ${recipientLeg.value} ${asset}`,
      claimedAmount,
      observedAmount: recipientLeg.value,
    });
  }

  // The fee must have actually reached the treasury. Without this check a client
  // could sign only the recipient leg and still be recorded as having paid the
  // fee — the uncollected-fee problem in a new shape, and harder to see.
  const treasuryLeg = await readTransferredAmount(
    input.txHash,
    getTokenContract(asset),
    env.SETI_TREASURY_ADDRESS,
    asset
  );

  if (!treasuryLeg.ok) {
    throw await refusal({
      userId: input.userId,
      txHash: input.txHash,
      code: 'fee-leg-unverified',
      reason:
        `Fee leg could not be verified on-chain: ${treasuryLeg.reason}. A send is ` +
        'only valid when the transaction moved both the recipient\'s principal ' +
        'and the fee to the treasury.',
      claimedAmount,
      observedAmount: recipientLeg.value,
    });
  }

  const observedPrincipal = recipientLeg.value;
  const treasuryFeeObserved = treasuryLeg.value;
  const grossAsset = observedPrincipal + treasuryFeeObserved;

  // Same derivation as a batched payment, so a send and a payment of the same
  // size persist the same figures: the principal in KES from the observed leg,
  // and the fee as the residue of the gross, so `gross == principal + fee` holds
  // exactly with no rounding residue.
  const principalFiat = round2(observedPrincipal * quote.fiatPerUsd);
  const feeFiat = round2(grossAsset * quote.fiatPerUsd - principalFiat);

  // Recomputed only to report whether a cap governed; it does not set the fee.
  const feeResult = calculateMerchantFee(principalFiat);

  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      walletId: wallet.id,
      type: 'p2p_send',
      status: 'processing',
      // What left the customer's wallet. The principal — what the person
      // actually received — is the fiat figure below, which is what the activity
      // row renders.
      amount: grossAsset.toFixed(8),
      asset: input.asset,
      counterparty: recipient,
      txHash: input.txHash,
      fiatAmount: principalFiat.toFixed(2),
      fiatCurrency: quote.fiatCurrency,
      feeAmount: feeFiat.toFixed(2),
      feeUncappedAmount: feeResult.uncappedFeeKes.toFixed(2),
      feeCapped: feeResult.cappedByMaxPercent,
      fxRate: quote.fiatPerUsd.toFixed(8),
      fxRateSource: quote.source,
      fxRateAsOf: quote.asOf,
      description: input.description,
      metadata: {
        // Namespaced for the same reason as `recordPayment`: this row is
        // evidence, and caller-supplied keys must not sit level with derived
        // ones.
        client: input.metadata ?? {},
        feeRoutingMode: 'batch',
        treasuryFeeObserved: treasuryFeeObserved.toFixed(8),
      } as never,
    },
  });

  // The recipient's side of the same transfer, when they are a Seti account.
  //
  // Without this a transfer between two accounts produced ONE row — the sender's —
  // and the person who received the money saw an empty Activity, which is exactly
  // what happened. Written here, in the same request as the sender's row, so the two
  // sides cannot disagree about what moved.
  await receivedSide({
    recipient,
    amountAsset: observedPrincipal,
    amountFiat: principalFiat,
    asset: input.asset,
    txHash: input.txHash,
    senderAddress: wallet.address,
    quote,
  });

  await logAuditEvent({
    userId: input.userId,
    action: 'send.recorded',
    txHash: input.txHash,
    metadata: {
      recipient,
      feeRoutingMode: 'batch',
      gross: grossAsset,
      fiatAmount: principalFiat,
      feeFiat,
      feeCapped: feeResult.cappedByMaxPercent,
      fxRate: quote.fiatPerUsd,
      fxRateSource: quote.source,
      treasuryFeeObserved,
    },
  });

  return transaction;
}

/**
 * Waits for an on-chain transaction receipt and advances the matching database
 * record to `completed` or `failed`.
 */
export async function confirmTransactionByHash(txHash: string, userId: string) {
  // Scoped to the caller: `txHash` is unique per USER, so a transfer between two
  // Seti accounts has one row on each side and an unscoped lookup would be a coin
  // toss. The one being confirmed is the caller's.
  const transaction = await prisma.transaction.findFirst({
    where: { txHash, userId },
    include: { wallet: true, merchant: true },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Only rows still awaiting confirmation may be advanced.
  if (transaction.status !== 'processing') {
    return transaction;
  }

  let receipt: TransactionReceipt;
  try {
    receipt = await waitForTransactionReceipt(txHash as Hex, 30_000, 2_000);
  } catch (error) {
    console.error(
      '[confirmTransactionByHash] confirmation timed out or failed',
      txHash,
      error
    );
    return transaction;
  }

  if (receipt.status !== 'success') {
    const failedTx = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'failed',
        failedAt: new Date(),
        blockNumber: receipt.blockNumber,
      },
    });

    await logAuditEvent({
      userId: transaction.userId,
      action: 'transaction.fail',
      txHash,
      metadata: { blockNumber: receipt.blockNumber.toString() },
    });

    return failedTx;
  }

  const confirmed = await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: 'completed',
      blockNumber: receipt.blockNumber,
      settledAt: new Date(),
    },
  });

  await logAuditEvent({
    userId: transaction.userId,
    action: 'transaction.confirm',
    txHash,
    metadata: { blockNumber: receipt.blockNumber.toString() },
  });

  return confirmed;
}
