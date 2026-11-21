/**
 * A READ-ONLY view of a customer's Polymarket account (#599).
 *
 * Polymarket's Data API answers two questions about any wallet address with no key and
 * no signature: what it is worth, and what it holds. That is the whole of this module.
 * Nothing here signs, writes, or moves money, and nothing here holds a Polyon key —
 * which is why the surface it feeds can exist before any decision about custody.
 *
 * THREE STATES, NOT ONE NUMBER. The trap this module exists to avoid is a figure that
 * is zero because the upstream failed. A wallet we have not linked, a wallet with no
 * positions, and a read that failed are three different sentences to a customer, so
 * they are three different shapes on the wire:
 *
 *  - `linked: false` — no address stored for this account. The card renders a link, not
 *    an error.
 *  - `positions: []` with a real `totalFiat` — the wallet is linked and genuinely holds
 *    nothing. That is an answer, and it is displayed as one.
 *  - a thrown `PolymarketRefusalError` — the read failed, timed out, or the upstream
 *    version this build speaks is gone. The card says unavailable, never zero.
 *
 * WHY THE VERSION IS PINNED TO `/v2`. Polymarket retired v1: the old paths answer HTTP
 * 410 with a migration notice, not a 404. A build that kept the old base URL would see
 * every read fail at once, so 410 is classified on its own (`polymarket-retired`) rather
 * than folded into `unavailable`, and the check pins both.
 *
 * WHY THE FIELD MAP IS STRICT. `redeemable`, `current_value` and the PnL triple are the
 * reasons the card exists. A renamed field would not throw on the upstream side; it would
 * arrive absent and a tolerant mapper would render zero, which is the exact defect this
 * surface was built to avoid. So the required fields are validated and a missing one is
 * `polymarket-payload`, which is diagnosable in a log rather than invisible on a screen.
 */
import { z } from 'zod';
import { getFxQuote } from './payments.js';

/** The Data API base this build speaks. Pinned: `.../v1/...` answers 410. */
export const POLYMARKET_DATA_BASE = 'https://data-api.polymarket.com/v2';

/** Long enough for a cold read, short enough that a card does not hang the page. */
const REQUEST_TIMEOUT_MS = 8_000;

export type PolymarketRefusalCode =
  | 'polymarket-address-invalid'
  | 'polymarket-retired'
  | 'polymarket-unavailable'
  | 'polymarket-payload';

export class PolymarketRefusalError extends Error {
  constructor(
    readonly code: PolymarketRefusalCode,
    message: string
  ) {
    super(message);
    this.name = 'PolymarketRefusalError';
  }
}

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * The address we will store, or a refusal.
 *
 * Lower-cased because every comparison against it downstream is a comparison of the same
 * address written two ways, and the upstream echoes it in lower case. The zero address is
 * refused explicitly: it satisfies every shape check and is not a wallet anyone can own,
 * so accepting it would store a link that can only ever answer "no positions".
 */
export function normalizePolymarketAddress(value: string): string {
  const trimmed = value.trim();
  if (!ADDRESS_PATTERN.test(trimmed)) {
    throw new PolymarketRefusalError(
      'polymarket-address-invalid',
      'That is not a wallet address. Paste the 42-character address from your Polymarket profile.'
    );
  }
  const lower = trimmed.toLowerCase();
  if (lower === ZERO_ADDRESS) {
    throw new PolymarketRefusalError(
      'polymarket-address-invalid',
      'The zero address is not a wallet. Paste the address from your Polymarket profile.'
    );
  }
  return lower;
}

/**
 * One holding, in the customer's currency.
 *
 * `totalPnlFiat` and `unrealizedPnlFiat` are the figures the card prints; `size` and the
 * two prices are carried because a position without them cannot be explained when the
 * number moves. Nothing here is computed on the client from these: the server converts
 * once, at one rate, so the rows always add up to the headline.
 */
export interface PolymarketPositionView {
  title: string;
  slug: string | null;
  outcome: string | null;
  redeemable: boolean;
  endDate: string | null;
  size: number;
  averagePrice: number;
  currentPrice: number;
  currentValueFiat: number;
  unrealizedPnlFiat: number;
  totalPnlFiat: number;
  percentPnl: number;
}

export interface PolymarketView {
  linked: true;
  address: string;
  fiatCurrency: string;
  /** Units of `fiatCurrency` per USD, as a string — the rate the rows were built at. */
  fxRate: string;
  fxSource: string;
  fxStale: boolean;
  totalFiat: number;
  totalUsd: number;
  /** Positions whose market resolved and whose money is claimable. The card's hook. */
  redeemableCount: number;
  positions: PolymarketPositionView[];
}

const positionSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  outcome: z.string().min(1).optional(),
  end_date: z.string().min(1).optional(),
  current_size: z.number(),
  avg_price: z.number(),
  current_price: z.number(),
  current_value: z.number(),
  unrealized_pnl: z.number(),
  total_pnl: z.number(),
  percent_pnl: z.number(),
  redeemable: z.boolean(),
});

const positionsEnvelopeSchema = z.object({ data: z.array(z.unknown()) });
const valueEnvelopeSchema = z.object({ data: z.object({ value: z.number() }) });

type JsonFetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function readJson(path: string, fetcher: JsonFetcher): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(`${POLYMARKET_DATA_BASE}${path}`, {
      headers: { accept: 'application/json', 'user-agent': 'seti.live' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new PolymarketRefusalError('polymarket-unavailable', `Polymarket could not be reached: ${message}`);
  }
  if (response.status === 410) {
    throw new PolymarketRefusalError(
      'polymarket-retired',
      'The Polymarket data version this build speaks has been retired.'
    );
  }
  if (!response.ok) {
    throw new PolymarketRefusalError('polymarket-unavailable', `Polymarket answered ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new PolymarketRefusalError('polymarket-payload', 'Polymarket answered with a body that is not JSON.');
  }
}

/** Two decimals, because every figure this module emits is money in a fiat currency. */
function fiat(value: number, perUsd: number): number {
  return Math.round(value * perUsd * 100) / 100;
}

/**
 * The mapping half, with every input as an argument.
 *
 * Split out so the check can pin the arithmetic and the field map without a network and
 * without a rate provider — the same reason the balance sum takes its inputs rather than
 * reading them. `getPolymarketView` is the only caller that fetches.
 */
export function mapPolymarketView(input: {
  address: string;
  valueBody: unknown;
  positionsBody: unknown;
  quote: { fiatCurrency: string; fiatPerUsd: number; source: string; stale: boolean };
}): PolymarketView {
  const value = valueEnvelopeSchema.safeParse(input.valueBody);
  if (!value.success) {
    throw new PolymarketRefusalError('polymarket-payload', 'The wallet value response carried no usable value.');
  }
  const envelope = positionsEnvelopeSchema.safeParse(input.positionsBody);
  if (!envelope.success) {
    throw new PolymarketRefusalError('polymarket-payload', 'The positions response carried no usable list.');
  }

  const rate = input.quote.fiatPerUsd;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new PolymarketRefusalError('polymarket-unavailable', 'No usable exchange rate is available right now.');
  }

  const positions: PolymarketPositionView[] = envelope.data.data.map((raw) => {
    const parsed = positionSchema.safeParse(raw);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
      throw new PolymarketRefusalError(
        'polymarket-payload',
        `A Polymarket position arrived without a required field (${missing}).`
      );
    }
    const row = parsed.data;
    return {
      title: row.title ?? row.slug ?? 'Unnamed market',
      slug: row.slug ?? null,
      outcome: row.outcome ?? null,
      redeemable: row.redeemable,
      endDate: row.end_date ?? null,
      size: row.current_size,
      averagePrice: row.avg_price,
      currentPrice: row.current_price,
      currentValueFiat: fiat(row.current_value, rate),
      unrealizedPnlFiat: fiat(row.unrealized_pnl, rate),
      totalPnlFiat: fiat(row.total_pnl, rate),
      percentPnl: row.percent_pnl,
    };
  });

  const totalUsd = value.data.data.value;

  return {
    linked: true,
    address: input.address,
    fiatCurrency: input.quote.fiatCurrency,
    fxRate: rate.toFixed(4),
    fxSource: input.quote.source,
    fxStale: input.quote.stale,
    totalFiat: fiat(totalUsd, rate),
    totalUsd,
    redeemableCount: positions.filter((position) => position.redeemable).length,
    positions,
  };
}

/**
 * Read a linked wallet's positions, converted once at one rate.
 *
 * Both reads are required. A wallet's total and its rows come from two endpoints, and
 * showing one without the other would be a card whose headline disagrees with its list —
 * so a failure in either is a refusal, not a partial view.
 *
 * `readQuote` is injectable so the check can pin the arithmetic with no rate provider.
 * It is not a policy seam: nothing in the application passes one.
 */
export async function getPolymarketView(input: {
  address: string;
  fiatCurrency: string;
  fetcher?: JsonFetcher;
  readQuote?: (fiatCurrency: string) => Promise<{
    fiatCurrency: string;
    fiatPerUsd: number;
    source: string;
    stale: boolean;
  }>;
}): Promise<PolymarketView> {
  const address = normalizePolymarketAddress(input.address);
  const fetcher: JsonFetcher = input.fetcher ?? ((url, init) => fetch(url, init));
  const readQuote = input.readQuote ?? ((fiatCurrency: string) => getFxQuote(fiatCurrency));

  const [valueBody, positionsBody, quote] = await Promise.all([
    readJson(`/value?user=${address}`, fetcher),
    readJson(`/positions?user=${address}`, fetcher),
    readQuote(input.fiatCurrency),
  ]);

  return mapPolymarketView({ address, valueBody, positionsBody, quote });
}
