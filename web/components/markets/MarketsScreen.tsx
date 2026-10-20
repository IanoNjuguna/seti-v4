'use client';

import { Text } from '@/components/ui';
import { MARKETS_COPY } from '@/lib/markets';
import { MarketsFilters } from './MarketsFilters';
import { MarketsGrid } from './MarketsGrid';
import { MarketsEmpty, MarketsFailure, MarketsLoading } from './MarketsStates';
import { MarketsSourceNote } from './MarketsSourceNote';
import { useMarkets } from './useMarkets';
import { useMarketsFilter } from './useMarketsFilter';

/**
 * Markets: the browse surface.
 *
 * One decision shapes this screen — there is no account behind it. Odds are public,
 * read-only and identical for everybody, so it renders the same signed in or out and
 * fires no account-scoped request. That is why this screen has no signed-out variant:
 * a visitor and a customer see the same page, and the difference appears later, at
 * the action that would move money.
 *
 * The order of the states is deliberate. The header is always there (the page says
 * what it is), then exactly one of loading, failure or the filtered list, and the
 * source note only once there are numbers to attribute.
 */
export function MarketsScreen() {
  const { state, retry } = useMarkets();
  const markets = state.kind === 'ready' ? state.markets : [];
  const filter = useMarketsFilter(markets);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Text variant="section" as="h1">
          {MARKETS_COPY.title}
        </Text>
        <Text variant="micro" color="secondary">
          {MARKETS_COPY.subtitle}
        </Text>
      </header>

      {state.kind === 'loading' ? <MarketsLoading /> : null}
      {state.kind === 'error' ? <MarketsFailure message={state.message} onRetry={retry} /> : null}

      {state.kind === 'ready' ? (
        <>
          <MarketsFilters value={filter.value} onChange={filter.setValue} />
          <MarketsGridOrEmpty
            markets={filter.visible}
            filtered={filter.isFiltered}
          />
          <MarketsSourceNote updatedAt={state.updatedAt} />
        </>
      ) : null}
    </div>
  );
}

interface ListProps {
  markets: ReturnType<typeof useMarketsFilter>['visible'];
  filtered: boolean;
}

/** The list, or the sentence that explains why there is not one. */
function MarketsGridOrEmpty({ markets, filtered }: ListProps) {
  if (markets.length === 0) return <MarketsEmpty filtered={filtered} />;
  return <MarketsGrid markets={markets} />;
}
