import { CATEGORY_HINTS, MARKETS_ROW_LIMIT } from './markets.constants';
import { formatClosesLabel } from './markets.format';
import type {
  GammaEvent,
  GammaMarket,
  GammaTag,
  MarketCategory,
  MarketEvent,
  MarketRow,
  MarketSummary,
} from './markets.types';

/**
 * Turning the venue's payload into the surface's own shape.
 *
 * Defensive on purpose: the payload is somebody else's product, fields are
 * optional, numbers arrive as strings, and a market with no book has nulls where a
 * price should be. A row that cannot be read is DROPPED rather than rendered with a
 * hole in it, because a card with a title and no number is worse than one card
 * fewer.
 */

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `["Yes","No"]` arrives as a JSON string, and so does every other list here. */
function parseList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

/** A Yes/No pair, whichever order the venue happened to send them in. */
function readYesNo(market: GammaMarket): { yes: number | null; no: number | null } {
  const labels = parseList(market.outcomes);
  const prices = parseList(market.outcomePrices).map((price) => Number.parseFloat(price));
  if (labels.length === 0 || prices.length === 0) return { yes: null, no: null };

  const yesIndex = labels.findIndex((label) => label.trim().toLowerCase() === 'yes');
  const index = yesIndex >= 0 ? yesIndex : 0;
  const yes = Number.isFinite(prices[index]) ? prices[index] : null;
  const other = index === 0 ? prices[1] : prices[0];
  const no = Number.isFinite(other) ? other : null;

  return { yes, no };
}

/**
 * Every category that applies, from two independent signals.
 *
 * The wording of the question is the weak one. The structural flag is the strong
 * one: the event embedded in a market row carries no tags at all (verified against
 * the live API), so a tennis match called "Lyon Open: Humbert vs Moutet" contains
 * no category keyword and would land in no chip at all. `sportsMarketType` and
 * `gameStartTime` are set by the venue when it knows the market is a game.
 */
function readCategories(
  tags: GammaTag[] | undefined,
  text: string,
  structuralSports: boolean
): MarketCategory[] {
  const tagText = (tags ?? []).map((tag) => `${tag.label ?? ''} ${tag.slug ?? ''}`).join(' ');
  const haystack = `${tagText} ${text}`.toLowerCase();

  const matched: MarketCategory[] = [];
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((word) => haystack.includes(word))) matched.push(hint.category);
  }

  if (structuralSports && !matched.includes('sports')) matched.unshift('sports');
  return matched;
}

/** A market the venue has already classified as a game. */
function isSportsMarket(market: GammaMarket): boolean {
  return Boolean(market.sportsMarketType ?? market.gameStartTime);
}

/** One list row, or `null` when the market cannot be read well enough to show. */
export function normalizeMarketRow(market: GammaMarket, now: Date): MarketSummary | null {
  const question = market.question?.trim();
  const event = market.events?.[0];
  const eventSlug = event?.slug?.trim();
  if (!question || !eventSlug) return null;

  const { yes, no } = readYesNo(market);
  if (yes === null && no === null) return null;

  const eventTitle = event?.title?.trim() ?? '';
  return {
    id: market.id ?? `${eventSlug}-${market.slug ?? question}`,
    slug: market.slug?.trim() ?? market.id ?? eventSlug,
    eventSlug,
    question,
    eventTitle,
    categories: readCategories(event?.tags, `${eventTitle} ${question}`, isSportsMarket(market)),
    yes,
    no,
    spread: toNumber(market.spread),
    volume24h: toNumber(market.volume24hr) ?? 0,
    closesLabel: formatClosesLabel(market.endDate, now),
  };
}

/** Highest-volume first, deduped, capped. */
export function normalizeMarketRows(markets: GammaMarket[], now: Date): MarketSummary[] {
  const seen = new Set<string>();
  const rows: MarketSummary[] = [];

  for (const market of markets) {
    const row = normalizeMarketRow(market, now);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }

  return rows.sort((a, b) => b.volume24h - a.volume24h).slice(0, MARKETS_ROW_LIMIT);
}

/** One event with its markets, for the detail route. */
export function normalizeEvent(event: GammaEvent, now: Date): MarketEvent | null {
  const title = event.title?.trim();
  const slug = event.slug?.trim();
  if (!title || !slug) return null;

  const markets = (event.markets ?? [])
    .map((market, index): MarketRow | null => {
      const question = market.question?.trim();
      if (!question) return null;

      const { yes, no } = readYesNo(market);
      if (yes === null && no === null) return null;

      return {
        id: market.id ?? `${slug}-${index}`,
        question,
        candidate: market.groupItemTitle?.trim() ? market.groupItemTitle.trim() : null,
        yes,
        no,
        spread: toNumber(market.spread),
        volume24h: toNumber(market.volume24hr) ?? 0,
      };
    })
    .filter((row): row is MarketRow => row !== null)
    .sort((a, b) => b.volume24h - a.volume24h);

  if (markets.length === 0) return null;

  const summed = markets.reduce((total, row) => total + row.volume24h, 0);

  return {
    id: event.id ?? slug,
    slug,
    title,
    categories: readCategories(
      event.tags,
      title,
      (event.markets ?? []).some((market) => isSportsMarket(market))
    ),
    volume24h: toNumber(event.volume24hr) ?? summed,
    closesLabel: formatClosesLabel(event.endDate, now),
    markets,
  };
}
