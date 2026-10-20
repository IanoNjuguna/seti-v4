import Link from 'next/link';
import { Card, Text } from '@/components/ui';
import { CATEGORY_CHIPS, MARKETS_COPY, formatCompactUsd } from '@/lib/markets';
import { ProbabilityBar } from './ProbabilityBar';
import type { MarketCardProps } from './markets.types';

/**
 * One market, as a row you can open.
 *
 * The card carries four things and no more: what is being asked, what the crowd
 * thinks, how much money is behind that opinion, and when it settles. The category
 * is a label rather than a badge with a colour, because a coloured fill on this
 * surface would imply a status and a category is not one.
 *
 * The whole card is the link, so the target is the card's own area rather than a
 * word inside it, and the visible question is the accessible name.
 */
export function MarketCard({ market }: MarketCardProps) {
  const category = labelForCategory(market.categories[0]);
  const volume = MARKETS_COPY.volume(formatCompactUsd(market.volume24h));

  return (
    <Link
      href={`/app/markets/${market.eventSlug}`}
      className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light"
    >
      <Card padding="sm" className="flex h-full flex-col justify-between gap-4 transition-colors hover:border-hairline-strong">
        <div className="flex items-baseline justify-between gap-3">
          <Text variant="micro" color="secondary">
            {category}
          </Text>
          <Text variant="micro" color="secondary" tabular>
            {volume}
          </Text>
        </div>

        <Text variant="card-title" as="h3" className="line-clamp-2">
          {market.question}
        </Text>

        <div className="flex flex-col gap-2">
          <ProbabilityBar value={market.yes} label={MARKETS_COPY.noQuotes} />
          <Text variant="micro" color="secondary">
            {market.closesLabel}
          </Text>
        </div>
      </Card>
    </Link>
  );
}

function labelForCategory(category: string | undefined): string {
  if (!category) return 'Market';
  const chip = CATEGORY_CHIPS.find((entry) => entry.id === category);
  return chip ? chip.label : 'Market';
}
