'use client';

import { Button, Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { POLYMARKET_CARD_COPY } from './PolymarketCard.constants';
import { PositionRow } from './PositionRow';
import { usePolymarketCard } from './usePolymarketCard';

/**
 * The Polymarket card (#599): what an external account of the customer's holds.
 *
 * READ-ONLY, and the card says so in one line rather than in a badge: Seti has no key for
 * this wallet and no path to move anything out of it. That is what makes it safe to put on
 * a money app's screen before any decision about trading.
 *
 * THE FIVE STATES ARE THE DESIGN. A signed-out visitor gets no account request at all, so
 * the ask comes before the fetch. An unlinked account gets a prompt, not an empty result.
 * A linked wallet with nothing in it says so, because that is an answer. And a failed read
 * has NO FIGURE on it — there is no code path here that can print `0` for a wallet whose
 * read timed out, which is the whole reason the hook withholds the view instead of zeroing
 * it.
 *
 * One figure, one list, no chart: the card's job is to answer "is there money over there
 * that I have forgotten about", and `ready to redeem` is the only line that ever asks the
 * customer to do something.
 */
export function PolymarketCard() {
  const { state, address, setAddress, pending, link, unlink, reload } = usePolymarketCard();

  return (
    <section className="rounded-md border border-hairline-light bg-surface-soft p-5">
      <header className="flex items-baseline justify-between gap-3">
        <Text variant="micro" color="secondary" as="h2">
          {POLYMARKET_CARD_COPY.eyebrow}
        </Text>
      </header>

      {state.kind === 'loading' ? (
        <div className="mt-4 h-16" aria-busy="true" />
      ) : null}

      {state.kind === 'signed-out' ? (
        <Text variant="body" color="secondary" as="p" className="mt-3">
          {POLYMARKET_CARD_COPY.unlinkedLede}
        </Text>
      ) : null}

      {state.kind === 'unlinked' ? (
        <div className="mt-3">
          <Text variant="card-title" as="p">
            {POLYMARKET_CARD_COPY.unlinkedTitle}
          </Text>
          <Text variant="body" color="secondary" as="p" className="mt-1">
            {POLYMARKET_CARD_COPY.unlinkedLede}
          </Text>
          <label className="mt-4 block">
            <Text variant="micro" color="secondary" as="span">
              {POLYMARKET_CARD_COPY.addressLabel}
            </Text>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={POLYMARKET_CARD_COPY.addressPlaceholder}
              spellCheck={false}
              autoComplete="off"
              className="mt-1 w-full rounded-sm border border-hairline-light bg-surface-elevated px-3 py-2 font-mono text-body outline-none focus-visible:border-ink"
            />
          </label>
          <Button className="mt-3" onClick={() => void link()} loading={pending} disabled={!address.trim() || pending}>
            {pending ? POLYMARKET_CARD_COPY.linking : POLYMARKET_CARD_COPY.linkAction}
          </Button>
        </div>
      ) : null}

      {state.kind === 'failed' ? (
        <div className="mt-3">
          <Text variant="card-title" as="p">
            {POLYMARKET_CARD_COPY.failedTitle}
          </Text>
          <Text variant="body" color="secondary" as="p" className="mt-1" role="alert">
            {state.message}
          </Text>
          <div className="mt-3 flex items-center gap-4">
            <Button onClick={() => void reload()}>{POLYMARKET_CARD_COPY.retry}</Button>
          </div>
        </div>
      ) : null}

      {state.kind === 'ready' ? (
        <div className="mt-3">
          <Text variant="micro" color="secondary" as="p">
            {POLYMARKET_CARD_COPY.totalLabel}
          </Text>
          <Text variant="balance-compact" as="p" tabular>
            {formatFiat(state.view.totalFiat, state.view.fiatCurrency)}
          </Text>
          <Text variant="micro" color="secondary" as="p" tabular>
            {POLYMARKET_CARD_COPY.rateLine(state.view.fxRate, state.view.fiatCurrency)}
          </Text>
          {state.view.redeemableCount > 0 ? (
            <Text variant="micro" color="success" as="p" className="mt-1">
              {POLYMARKET_CARD_COPY.redeemable(state.view.redeemableCount)}
            </Text>
          ) : null}
          {state.view.fxStale ? (
            <Text variant="micro" color="warning" as="p" className="mt-1">
              {POLYMARKET_CARD_COPY.staleRate}
            </Text>
          ) : null}

          {state.view.positions.length === 0 ? (
            <div className="mt-4">
              <Text variant="body" as="p">
                {POLYMARKET_CARD_COPY.emptyTitle}
              </Text>
              <Text variant="micro" color="secondary" as="p">
                {POLYMARKET_CARD_COPY.emptyLede}
              </Text>
            </div>
          ) : (
            <ul className="mt-4">
              {state.view.positions.map((position) => (
                <PositionRow
                  key={`${position.slug ?? position.title}-${position.outcome ?? 'none'}`}
                  position={position}
                  currency={state.view.fiatCurrency}
                />
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => void unlink()}
            disabled={pending}
            className="mt-4 text-micro text-ink underline underline-offset-2 disabled:opacity-50"
          >
            {POLYMARKET_CARD_COPY.change}
          </button>
        </div>
      ) : null}
    </section>
  );
}
