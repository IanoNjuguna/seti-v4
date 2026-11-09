/**
 * Whether each convertible direction has a book behind it, right now.
 *
 * ## Why the allowlist cannot answer this
 *
 * `CONVERT_PAIRS` is a static list of pairs, and `isAllowedPair` accepts either side
 * of one entry, so the picker offers both directions of every pair. Liquidity is not
 * symmetric and not stable: on mainnet `usdc.e → ousd` fills at 1bps while
 * `ousd → usdc.e` refuses with `convert-no-liquidity`, because nobody is selling OUSD
 * into the book that hour (#482, #496).
 *
 * The allowlist already exists to stop the picker offering "a button that fails after
 * the customer has chosen an amount" (`services/convert.ts`). A static list cannot do
 * that job for a directional book, so the direction is probed here and published
 * beside the list. The list stays the REFUSAL GATE; this is guidance.
 *
 * ## Fail OPEN, deliberately
 *
 * An RPC outage and an empty book are not the same fact, and a swap that works must
 * never be greyed out because a node was slow. Any failure that is not the book
 * itself refusing leaves the direction marked live: the customer still reaches the
 * quote, which will answer truthfully, and the worst case is the refusal they would
 * have got anyway.
 *
 * ## Cache
 *
 * A page load asks once. Ten view reads per render would be rude to a public RPC for a
 * control that greys itself out, and a minute of staleness cannot cost anybody money:
 * the quote is what gets signed, and it is priced at request time.
 */
import { quoteDexConvert, ConvertRefusalError } from './convert.js';
import type { SupportedAsset } from '../config/assets.js';
import type { Network } from '../lib/network.js';

/** The size every direction is probed at: 10.000000, the size the check suite quotes. */
export const LIVENESS_PROBE_UNITS = 10_000_000n;

/** How long one network's answer is reused. */
const TTL_MS = 60_000;

/**
 * How long an answer is reused when the probe could not reach the book at all.
 *
 * Short, because it is not evidence about the book — it is evidence that a node was
 * unreachable a moment ago, and that is worth five seconds of trust, not a minute.
 *
 * It exists because NOT caching this made an outage worse than the traffic it was in:
 * every pairs request re-ran all ten probes exactly when the RPC could least afford it
 * (#507).
 */
const UNKNOWN_TTL_MS = 5_000;

/** `in→out`, the same shape `PAR_BAND_BPS` keys a direction by. */
export function directionKey(assetIn: SupportedAsset, assetOut: SupportedAsset): string {
  return `${assetIn}→${assetOut}`;
}

interface Answer {
  at: number;
  /** False when the probe could not reach the book at all, so nothing may be ruled out. */
  known: boolean;
  live: ReadonlySet<string>;
  /** How long THIS answer may be reused: a minute when known, seconds when not. */
  ttl: number;
}

const cache = new Map<Network, Answer>();

/**
 * The directions that answered, for one network.
 *
 * `known: false` means the probe could not ask: every caller must then treat every
 * direction as live rather than empty.
 */
export async function liveDirections(
  network: Network,
  directions: ReadonlyArray<{ in: SupportedAsset; out: SupportedAsset }>
): Promise<{ known: boolean; live: ReadonlySet<string> }> {
  const cached = cache.get(network);
  if (cached && Date.now() - cached.at < cached.ttl) return cached;

  const answers = await Promise.all(
    directions.map(async (direction) => {
      try {
        await quoteDexConvert({
          assetIn: direction.in,
          assetOut: direction.out,
          amountIn: LIVENESS_PROBE_UNITS,
          network,
        });
        return { key: directionKey(direction.in, direction.out), live: true, known: true };
      } catch (error) {
        // The book itself refusing is an answer: no orders to fill against.
        if (error instanceof ConvertRefusalError) {
          return { key: directionKey(direction.in, direction.out), live: false, known: true };
        }
        // Anything else is the probe failing, not the book answering.
        return { key: directionKey(direction.in, direction.out), live: true, known: false };
      }
    })
  );

  const known = answers.every((answer) => answer.known);
  const answer: Answer = {
    at: Date.now(),
    known,
    ttl: known ? TTL_MS : UNKNOWN_TTL_MS,
    live: new Set(answers.filter((entry) => entry.live).map((entry) => entry.key)),
  };

  // Cached EITHER WAY, on the ttl above. The comment here used to say a half-known
  // answer must not be cached because it "could hide a direction for the next minute";
  // that is not what unknown means. Unknown marks EVERYTHING live, so caching it cannot
  // grey anything out — it only stops a failing probe from being re-run per request,
  // which is what turned an RPC incident into ten reads per page load (#507).
  cache.set(network, answer);
  return answer;
}

/** Test seam: forget every cached answer. */
export function clearLivenessCache(): void {
  cache.clear();
}
