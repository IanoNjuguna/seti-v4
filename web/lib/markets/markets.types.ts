/**
 * The shapes the Markets surface speaks in.
 *
 * Three layers, deliberately separate:
 *
 *  - `Gamma*` — the venue's own payload, loose and optional because every field
 *    there is optional and a market with no book has nulls where a price should be.
 *    Nothing outside `markets.map.ts` should see these.
 *  - `MarketSummary` — one row in the list. Built from `/markets`, NOT `/events`:
 *    an events payload is 7.3 MB for 60 rows because each event embeds all of its
 *    markets with full descriptions, while the same 60 markets are 431 KB and the
 *    eight fields the row renders are 18 KB. See `markets.constants.ts`.
 *  - `MarketEvent` — one event with its markets, for the detail route only, from
 *    `/events?slug=`, which is ~18 KB for a single event.
 *
 * Every figure the UI prints is already a number or a finished string
 * (`closesLabel`), so no date or currency formatting ever happens during render.
 */

/** The categories the filter chips expose. */
export type MarketCategory = 'politics' | 'sports' | 'crypto' | 'economy' | 'culture';

/** One row in the list: a single market, its event, and its prices. */
export interface MarketSummary {
  id: string;
  /** The market's own slug, unique per outcome. */
  slug: string;
  /** The event it belongs to — used to open the detail route. */
  eventSlug: string;
  question: string;
  /** The event's headline, when it is different from the question. */
  eventTitle: string;
  categories: MarketCategory[];
  /** Yes price, 0..1. `null` when the market has no book, never `0`. */
  yes: number | null;
  no: number | null;
  /** Best ask minus best bid, in points of a dollar. */
  spread: number | null;
  volume24h: number;
  /** Pre-formatted on the server: `Closes 31 Oct`, `Closes in 3 days`. */
  closesLabel: string;
}

/** One binary market inside the detail view. */
export interface MarketRow {
  id: string;
  question: string;
  /** The candidate or date a grouped market belongs to, when there is one. */
  candidate: string | null;
  yes: number | null;
  no: number | null;
  spread: number | null;
  volume24h: number;
}

export interface MarketEvent {
  id: string;
  slug: string;
  title: string;
  categories: MarketCategory[];
  volume24h: number;
  closesLabel: string;
  markets: MarketRow[];
}

export interface MarketListResponse {
  source: string;
  updatedAt: string;
  markets: MarketSummary[];
}

export interface MarketEventResponse {
  event: MarketEvent | null;
}

/* ------------------------------------------------------------------ */
/* Upstream payload. Optional everywhere because it genuinely is.      */
/* ------------------------------------------------------------------ */

export interface GammaTag {
  label?: string;
  slug?: string;
}

export interface GammaEventRef {
  slug?: string;
  title?: string;
  tags?: GammaTag[];
}

export interface GammaMarket {
  id?: string;
  slug?: string;
  question?: string;
  groupItemTitle?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume24hr?: number | string | null;
  spread?: number | string | null;
  endDate?: string | null;
  /**
   * Present when the venue knows this is a sports market. It is a structural
   * signal and the ONLY reliable one: the event reference embedded in a market row
   * carries no tags, so a tennis match would otherwise be categorised by whether
   * its title happens to contain the word.
   */
  sportsMarketType?: string | null;
  gameStartTime?: string | null;
  events?: GammaEventRef[];
  closed?: boolean;
  active?: boolean;
}

export interface GammaEvent {
  id?: string;
  slug?: string;
  title?: string;
  endDate?: string | null;
  volume24hr?: number | string | null;
  markets?: GammaMarket[];
  tags?: GammaTag[];
  closed?: boolean;
}
