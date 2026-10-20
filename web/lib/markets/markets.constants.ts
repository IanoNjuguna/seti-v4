import type { MarketCategory } from './markets.types';

/**
 * Where the odds come from, and the two endpoints the surface reads.
 *
 * Two endpoints on purpose, and the choice is a payload decision measured against
 * the live API: `/events` is 7.3 MB for 60 rows because every event embeds its
 * markets with full descriptions, while the same 60 markets from `/markets` are
 * 431 KB, and the eight fields a row actually renders are 18 KB. The list
 * therefore reads markets, and only the detail route reads a single event.
 *
 * The venue is named in one place because the surface states it on screen: a
 * number next to a question with no attribution reads as Seti's own opinion.
 */
export const MARKETS_SOURCE = 'Polymarket';
export const MARKETS_SOURCE_URL = 'https://polymarket.com';
export const MARKETS_EVENT_URL = (slug: string): string =>
  `${MARKETS_SOURCE_URL}/event/${encodeURIComponent(slug)}`;

/** Keyless public reads. No auth, no key, nothing to leak. */
export const GAMMA_MARKETS_URL = 'https://gamma-api.polymarket.com/markets';
export const GAMMA_EVENTS_URL = 'https://gamma-api.polymarket.com/events';

/** How many rows one list request asks for, highest 24h volume first. */
export const MARKETS_ROW_LIMIT = 60;

/**
 * The browser holds the response for 30s and the CDN for 60s. Prices move, so a
 * long cache would print a stale probability as fact; the surface says how fresh
 * it is rather than pretending it is real time.
 */
export const MARKETS_CACHE_CONTROL = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';

/**
 * Tag and title hints, in priority order. The venue's tags are free text and
 * inconsistent (`Israel x Iran` sits beside `Geopolitics`), so a category is
 * decided by the first hint list that matches rather than by a tag id we do not
 * control.
 */
export const CATEGORY_HINTS: Array<{ category: MarketCategory; words: string[] }> = [
  {
    category: 'politics',
    words: [
      'politics',
      'election',
      'president',
      'prime minister',
      'parliament',
      'senate',
      'congress',
      'geopolitics',
      'war',
      'ceasefire',
      'military',
      'trump',
      'israel',
      'iran',
      'russia',
      'ukraine',
      'tariff',
      'government',
    ],
  },
  {
    category: 'sports',
    words: [
      'sports',
      'nba',
      'nfl',
      'mlb',
      'nhl',
      'soccer',
      'football',
      'tennis',
      'formula 1',
      'ufc',
      'boxing',
      'cricket',
      'esports',
      'league of legends',
      'champions league',
      'premier league',
      'world cup',
      'olympics',
    ],
  },
  {
    category: 'crypto',
    words: ['crypto', 'bitcoin', 'btc', 'ethereum', 'solana', 'xrp', 'airdrop', 'defi', 'stablecoin'],
  },
  {
    category: 'economy',
    words: [
      'economy',
      'economics',
      'fed',
      'interest rate',
      'inflation',
      'recession',
      'stocks',
      'earnings',
      'ipo',
      'gdp',
      'business',
    ],
  },
  {
    category: 'culture',
    words: [
      'culture',
      'music',
      'movie',
      'film',
      'oscars',
      'grammy',
      'celebrity',
      'entertainment',
      'award',
      'album',
      'tiktok',
      'youtube',
    ],
  },
];

/** The chips, in display order. `all` is the unfiltered view. */
export const CATEGORY_CHIPS: Array<{ id: MarketCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'politics', label: 'Politics' },
  { id: 'sports', label: 'Sports' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'economy', label: 'Economy' },
  { id: 'culture', label: 'Culture' },
];

export const MARKETS_COPY = {
  title: 'Markets',
  subtitle: 'What people think will happen, priced by the crowd.',
  filterLabel: 'Filter markets by category',
  updated: (clock: string) => `Odds from ${MARKETS_SOURCE}, refreshed ${clock}`,
  loading: 'Loading markets',
  emptyTitle: 'No markets open',
  emptyBody: 'Nothing is trading right now. Check back later.',
  filteredEmptyTitle: 'Nothing in this category',
  filteredEmptyBody: 'No open markets match this filter. Try All.',
  failureTitle: "Couldn't load markets",
  failureBody: 'The odds feed did not answer. The rest of Seti is unaffected.',
  retry: 'Try again',
  noQuotes: 'No quotes yet',
  noShort: 'No',
  volume: (label: string) => `${label} today`,
  back: 'All markets',
  detailFailureTitle: "Couldn't load this market",
  detailFailureBody: 'The odds feed did not answer for this event.',
  notFoundTitle: 'Market not found',
  notFoundBody: 'This event is closed, or the link is wrong.',
  tradeAtSource: `Open on ${MARKETS_SOURCE}`,
  readOnlyNote: 'Odds are read-only. Trading, positions and settlement happen at the venue, not on Seti.',
  disclaimer: `Odds are read-only and come from ${MARKETS_SOURCE}. Trading, positions and settlement happen there, not on Seti.`,
  rows: (count: number) => (count === 1 ? '1 outcome' : `${count} outcomes`),
} as const;
