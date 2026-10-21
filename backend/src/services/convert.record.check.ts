/**
 * Prove the convert RECORD path — `check:convert-record`.
 *
 * Two different things are proved here, and it is worth being explicit about which
 * is which:
 *
 *  1. THE LEG READER against a REAL swap. The pinned transaction is a genuine
 *     USDC.e → pathUSD swap on Tempo mainnet, picked out of the DEX's own Transfer
 *     logs rather than written by hand. Its receipt is fed to the SAME function
 *     `recordConvert` uses (`readTransferredAmount`), and both legs are asserted:
 *     the input reaching the DEX, and the output reaching the customer's wallet.
 *     If Tempo ever changes what a swap emits, this check goes red and the record
 *     path is not silently wrong.
 *
 *  2. THE RULES that need no chain and no database: the pair gate, the floor
 *     comparison, and the leg reader's own refusals (wrong token, wrong
 *     recipient). These are the paths a hostile or merely broken client hits.
 *
 * What is NOT proved here: `recordConvert` end to end. That needs a wallet, a
 * signed swap and rows, which is the practice pass on a device. This check proves
 * the parts that decide whether a row is allowed to exist.
 *
 * The pinned transaction is MAINNET and is read from the mainnet RPC on purpose:
 * CI serves practice, and a check that only passes on the network it was written
 * on is not a check. The chain-specific assertions below are derived from the
 * served network rather than hard-coded to one.
 */

import { createPublicClient, http, type TransactionReceipt } from 'viem';
import { networkConfigFor, servedNetwork, getTokenContract, STABLECOIN_DEX_ADDRESS } from './chain.js';
import { isAllowedPair } from './convert.js';
import { readTransferredAmount, shortOfFloor } from './transactions.js';

let failures = 0;
let asserts = 0;

function check(label: string, pass: boolean, detail?: string | number) {
  asserts += 1;
  if (!pass) failures += 1;
  const mark = pass ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${label}${detail === undefined ? '' : ` — ${detail}`}`);
}

/** A real USDC.e → pathUSD swap on mainnet, found in the DEX's Transfer logs. */
const PINNED_SWAP = '0xdac5c6cd47890bfa7a2ecad811376d2b56fb81f3deb02b18eea651fd3f5d227e';
/** The wallet that swapped, and the figures its receipt carries. */
const SWAPPER = '0xb2278feb95f901169b3ff97460b41975e53fd33f';
const EXPECTED_IN = 0.099152;
const EXPECTED_OUT = 0.099132;

async function main(): Promise<void> {
  console.log(`convert record — served network: ${servedNetwork}`);

  const mainnet = createPublicClient({
    transport: http(networkConfigFor('mainnet').rpcUrl, { timeout: 30_000 }),
  });

  // -------------------------------------------------------------- the leg reader
  let receipt: TransactionReceipt | undefined;
  try {
    receipt = await mainnet.getTransactionReceipt({ hash: PINNED_SWAP });
  } catch (error) {
    check('the pinned swap receipt can be read', false, String(error).slice(0, 120));
  }

  if (receipt) {
    check('the pinned swap succeeded', receipt.status === 'success', receipt.status);

    const usdc = getTokenContract('usdc.e', 'mainnet');
    const pathUsd = getTokenContract('pathusd', 'mainnet');
    const ousd = getTokenContract('ousd', 'mainnet');

    // The INPUT leg, read exactly as `recordConvert` reads it: the customer's token,
    // to the DEX precompile.
    const inLeg = readTransferredAmount(receipt, usdc, STABLECOIN_DEX_ADDRESS, 'usdc.e');
    check(
      'the input leg to the DEX is found on a real swap',
      inLeg.ok && Math.abs(inLeg.value - EXPECTED_IN) < 0.000001,
      inLeg.ok ? inLeg.value : inLeg.reason
    );

    // The OUTPUT leg: the other token, back to the wallet that signed.
    const outLeg = readTransferredAmount(receipt, pathUsd, SWAPPER, 'pathusd');
    check(
      'the output leg to the signing wallet is found on a real swap',
      outLeg.ok && Math.abs(outLeg.value - EXPECTED_OUT) < 0.000001,
      outLeg.ok ? outLeg.value : outLeg.reason
    );

    // And the reader is not credulous: the same token, two wrong recipients, must be
    // refused rather than matched to something nearby.
    const wrongRecipient = readTransferredAmount(receipt, pathUsd, STABLECOIN_DEX_ADDRESS, 'pathusd');
    check(
      'a token that did not reach the named recipient is refused',
      !wrongRecipient.ok,
      wrongRecipient.ok ? `matched ${wrongRecipient.value}` : wrongRecipient.code
    );

    const wrongToken = readTransferredAmount(receipt, ousd, SWAPPER, 'ousd');
    check(
      'a token absent from the transaction is refused',
      !wrongToken.ok,
      wrongToken.ok ? `matched ${wrongToken.value}` : wrongToken.code
    );

    // The direction that matters for the input leg: the DEX is not a wallet, so a
    // transfer FROM the customer INTO the DEX is what proves the money left. Reading
    // the same token with the customer as the recipient must find nothing out.
    const inLegAsRecipient = readTransferredAmount(receipt, usdc, SWAPPER, 'usdc.e');
    check(
      'the input leg is not mistaken for a payout to the customer',
      !inLegAsRecipient.ok,
      inLegAsRecipient.ok ? `matched ${inLegAsRecipient.value}` : inLegAsRecipient.code
    );
  }

  // ------------------------------------------------------------------ the pair gate
  check('ousd → pathusd is on the allowlist', isAllowedPair('ousd', 'pathusd', servedNetwork));
  check('the same asset twice is not a pair', !isAllowedPair('ousd', 'ousd', servedNetwork));
  check(
    'usdt0 is on no allowlist on this network',
    !isAllowedPair('usdt0', 'ousd', servedNetwork) && !isAllowedPair('usdc.e', 'usdt0', servedNetwork)
  );

  // -------------------------------------------------------------------- the floor
  check('an exact fill meets the floor', !shortOfFloor(10, 10), 'observed 10, floor 10');
  check(
    'a fill a token unit short still meets the floor',
    !shortOfFloor(9.9999994, 10),
    'observed 9.9999994, floor 10'
  );
  check('a fill below the floor is short', shortOfFloor(9.99, 10), 'observed 9.99, floor 10');
  check(
    'the floor is one-sided: paying more is never refused',
    !shortOfFloor(10.5, 10),
    'observed 10.5, floor 10'
  );

  console.log(`\n${asserts - failures}/${asserts} checks passed`);
  if (failures > 0) {
    console.error(`${failures} FAILED`);
    process.exit(1);
  }
}

void main();
