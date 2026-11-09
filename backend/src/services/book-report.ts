/**
 * The book, read as a matrix: every allowed pair, BOTH directions, one line each.
 *
 * ## Why this is not inside the check suite
 *
 * It used to be. `check:convert` printed the matrix and then went on to assert things
 * about routes, refusals and the amount rule — which meant the matrix could only be
 * printed by a process that had a database URL, a JWT secret and a mainnet opt-in, and
 * the nightly job carried all of them to read a book (#493, #480).
 *
 * The two callers now supply only what they have. The gate passes `quoteDexConvert` and
 * its own refusal classifier, because it should exercise the production path. The
 * report passes a bare `quoteSwapExactAmountIn` read and the same band module, because
 * a read job has no business being handed a signing key.
 *
 * ## What is shared, and what must stay shared
 *
 * The BANDS are shared: `par-bands.ts`. They are the only numbers here that could drift
 * between the two callers, and a report that judged a spread against a different band
 * than the gate would be a report about a different product.
 *
 * The QUOTE is not shared, by design: the gate must exercise the code a customer's swap
 * goes through, and the report must not need the environment that code needs. Both read
 * one function on one contract, so there is one definition of "what the book said".
 */
import { LIVE_BOOK_HEADROOM_BPS, bandFor } from './par-bands.js';
import type { Network } from '../lib/network.js';
import type { SupportedAsset } from '../config/assets.js';

/** The size every direction is quoted at, in token units: 10.000000, as measured. */
export const BOOK_QUOTE_SIZE = 10_000_000n;

/**
 * Column widths for the matrix. Wide enough for `report` and for the longest pair on
 * either allowlist (`pathusd → usdc.e`), so the status and the pair line up down the
 * block exactly as the arrow lines elsewhere do.
 */
export const BOOK_STATUS_WIDTH = 9;
export const BOOK_PAIR_WIDTH = 20;

/** One direction of one pair, as the book answered it. */
export interface BookReading {
  readonly assetIn: SupportedAsset;
  readonly assetOut: SupportedAsset;
  readonly answer:
    | {
        readonly kind: 'quote';
        readonly amountOut: bigint;
        readonly minAmountOut: bigint;
        /** Against par, in whole basis points: the integer the band is judged on. */
        readonly spreadBps: number;
      }
    | { readonly kind: 'refused'; readonly code: string };
}

/** What the book answered, before any judgement: the only thing a caller must supply. */
export interface BookQuote {
  amountOut: bigint;
  minAmountOut: bigint;
}

export type BookQuotePort = (input: {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  amountIn: bigint;
}) => Promise<BookQuote>;

/** One line of the matrix, and the verdict it carries. */
export interface JudgedReading {
  readonly status: 'ok' | 'report' | 'FAIL';
  readonly pair: string;
  readonly detail: string;
}

export function formatMatrixLine(status: JudgedReading['status'], pair: string, detail: string): string {
  return `${status.padEnd(BOOK_STATUS_WIDTH)}${pair.padEnd(BOOK_PAIR_WIDTH)}${detail}`;
}

/**
 * Hold one reading to its measured band, or report that the venue refused.
 *
 *  - `convert-no-liquidity` is the market's answer. Reported, never a failure.
 *  - any OTHER code is our mapping failing (an asset this network does not list, a pair
 *    we allow with no contracts) rather than the market emptying. A gate may depend on
 *    what we wrote down; it may not depend on who holds USDT0 at that hour.
 *  - an answered quote outside `band + LIVE_BOOK_HEADROOM_BPS` is a hard failure: the
 *    book MOVED, and a customer would be quoted a price the product does not expect.
 *  - a pair with no band is a hard failure: there is no number to hold it to, and
 *    defaulting one would be inventing a tolerance.
 */
export function judgeReading(reading: BookReading, network: Network): JudgedReading {
  const pair = `${reading.assetIn} → ${reading.assetOut}`;

  if (reading.answer.kind === 'refused') {
    const { code } = reading.answer;
    return {
      status: code === 'convert-no-liquidity' ? 'report' : 'FAIL',
      pair,
      detail: `refused ${code}`,
    };
  }

  const { spreadBps } = reading.answer;
  const measured = spreadBps.toFixed(2);
  const band = bandFor(network, reading.assetIn, reading.assetOut);

  if (band === undefined) {
    return { status: 'FAIL', pair, detail: `${measured} bps, no entry in PAR_BAND_BPS` };
  }

  const allowed = band + LIVE_BOOK_HEADROOM_BPS;
  if (spreadBps > allowed) {
    return { status: 'FAIL', pair, detail: `${measured} bps > ${allowed} bps allowed` };
  }

  return { status: 'ok', pair, detail: `${measured} bps` };
}

export interface ReadDirectionInput {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  network: Network;
  quote: BookQuotePort;
  /** How a caller turns a thrown value into a refusal code. The gate and the report
   * classify differently on purpose: the gate knows `ConvertRefusalError`, and the
   * report must not import the module that declares it. */
  refusalCode: (error: unknown) => string;
}

/** Quote ONE direction and judge it. Printing is the caller's job, so is counting. */
export async function readDirection(input: ReadDirectionInput): Promise<{
  reading: BookReading;
  judged: JudgedReading;
}> {
  const { assetIn, assetOut, network, quote, refusalCode } = input;

  try {
    const quoted = await quote({ assetIn, assetOut, amountIn: BOOK_QUOTE_SIZE });

    // Integer basis points, the same arithmetic the band comparison uses, so the figure
    // printed is the figure judged: 2.0000000004 > 2 in floating point, and a quote is
    // integers all the way.
    const spreadBps = Number(
      ((BOOK_QUOTE_SIZE - quoted.amountOut) * BigInt(10_000)) / BOOK_QUOTE_SIZE
    );

    const reading: BookReading = {
      assetIn,
      assetOut,
      answer: { kind: 'quote', amountOut: quoted.amountOut, minAmountOut: quoted.minAmountOut, spreadBps },
    };

    return { reading, judged: judgeReading(reading, network) };
  } catch (error) {
    const reading: BookReading = {
      assetIn,
      assetOut,
      answer: { kind: 'refused', code: refusalCode(error) },
    };

    return { reading, judged: judgeReading(reading, network) };
  }
}

/**
 * The matrix: every pair on the allowlist, BOTH directions, one line each, in order.
 *
 * This replaced a loop that quoted each pair once, in the direction the table happened
 * to be written, and turned any refusal into a failure — a third party's inventory
 * reported as a defect in this repository, and the other side of the book never asked
 * (#303).
 */
export async function scanBook(input: {
  pairs: ReadonlyArray<readonly [SupportedAsset, SupportedAsset]>;
  network: Network;
  quote: BookQuotePort;
  refusalCode: (error: unknown) => string;
  onJudged?: (judged: JudgedReading) => void;
}): Promise<{ readings: BookReading[]; judged: JudgedReading[] }> {
  const directions: Array<readonly [SupportedAsset, SupportedAsset]> = [];
  for (const [a, b] of input.pairs) directions.push([a, b], [b, a]);

  const readings: BookReading[] = [];
  const judgedLines: JudgedReading[] = [];

  for (const [assetIn, assetOut] of directions) {
    const { reading, judged } = await readDirection({
      assetIn,
      assetOut,
      network: input.network,
      quote: input.quote,
      refusalCode: input.refusalCode,
    });
    readings.push(reading);
    judgedLines.push(judged);
    input.onJudged?.(judged);
  }

  return { readings, judged: judgedLines };
}
