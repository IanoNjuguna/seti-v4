'use client';

import Link from 'next/link';
import { Button, StateMessage, Text } from '@/components/ui';
import { MARKETS_COPY, formatCompactUsd } from '@/lib/markets';
import { MarketOutcomeRow } from './MarketOutcomeRow';
import { MarketsSourceNote } from './MarketsSourceNote';
import { useMarketEvent } from './useMarketEvent';
import type { MarketEventScreenProps } from './markets.types';

/**
 * One event, with its outcomes.
 *
 * Four states, and the "not found" one is the reason this is a client page rather
 * than a server component with a 404: a closed event is not a broken link, it is a
 * market a customer followed from somewhere and it deserves a sentence and a way
 * back, not a bare status code.
 *
 * The back link is a control, not a heading, so it sits above the title where a
 * reader looks for it and never competes with the question being asked.
 */
export function MarketEventScreen({ slug }: MarketEventScreenProps) {
  const { state, retry } = useMarketEvent(slug);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/app/markets"
        className="w-fit rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light"
      >
        <Text variant="micro" color="secondary">
          ← {MARKETS_COPY.back}
        </Text>
      </Link>

      {state.kind === 'loading' ? <HeaderSkeleton /> : null}

      {state.kind === 'missing' ? (
        <StateMessage
          variant="empty"
          title={MARKETS_COPY.notFoundTitle}
          body={MARKETS_COPY.notFoundBody}
          action={
            <Button variant="secondary" onClick={retry}>
              {MARKETS_COPY.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === 'error' ? (
        <StateMessage
          variant="failure"
          title={MARKETS_COPY.detailFailureTitle}
          body={`${MARKETS_COPY.detailFailureBody} (${state.message})`}
          action={
            <Button variant="secondary" onClick={retry}>
              {MARKETS_COPY.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <header className="flex flex-col gap-2">
            <Text variant="heading-md" as="h1">
              {state.event.title}
            </Text>
            <Text variant="micro" color="secondary" tabular>
              {MARKETS_COPY.rows(state.event.markets.length)} ·{' '}
              {MARKETS_COPY.volume(formatCompactUsd(state.event.volume24h))} · {state.event.closesLabel}
            </Text>
          </header>

          <div className="flex flex-col">
            {state.event.markets.map((market) => (
              <MarketOutcomeRow
                key={market.id}
                question={market.question}
                candidate={market.candidate}
                yes={market.yes}
                spread={market.spread}
              />
            ))}
          </div>

          <MarketsSourceNote />
        </>
      ) : null}
    </div>
  );
}

/** The header's shape while it arrives: a title line and a metadata line. */
function HeaderSkeleton() {
  return (
    <div aria-busy="true" aria-label={MARKETS_COPY.loading} className="flex flex-col gap-3">
      <span className="block h-7 w-3/4 rounded-sm bg-surface-soft" />
      <span className="block h-3 w-1/2 rounded-sm bg-surface-soft" />
      <span className="block h-16 w-full rounded-sm bg-surface-soft" />
    </div>
  );
}
