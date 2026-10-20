import type { MarketSummary } from '@/lib/markets';
import { MarketCard } from './MarketCard';

/**
 * The list itself.
 *
 * Two columns from `sm` up, one below it. The card is driven by its content, not by
 * a fixed height, so a long question grows the row rather than truncating the only
 * thing the row is about: the grid aligns because the cards stretch, and the
 * skeleton repeats the same geometry.
 *
 * Markets are grouped by nothing on purpose. The feed is sorted by 24-hour volume,
 * which is the only ordering a customer can reason about without a taxonomy, and a
 * heading per category would double the vertical space to say what the chip row
 * already says.
 */
export function MarketsGrid({ markets }: { markets: MarketSummary[] }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
