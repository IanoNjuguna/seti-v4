import { Text } from '@/components/ui';
import { MARKETS_COPY, MARKETS_SOURCE_URL, formatRefreshClock } from '@/lib/markets';

/**
 * Where the numbers come from, and how old they are.
 *
 * This line is not decoration. A price next to a question with no attribution reads
 * as Seti's own opinion, and Seti does not take a view: the crowd on another venue
 * does, and this app repeats it. So the venue is named, the refresh time is a wall
 * clock rather than "just now", and the read-only claim is spelled out.
 */
export function MarketsSourceNote({ updatedAt }: { updatedAt?: string }) {
  return (
    <footer className="flex flex-col gap-1 border-t border-hairline-light pt-4">
      {updatedAt ? (
        <Text variant="micro" color="secondary">
          {MARKETS_COPY.updated(formatRefreshClock(updatedAt))}
        </Text>
      ) : null}
      <Text variant="micro" color="secondary">
        {MARKETS_COPY.readOnlyNote}{' '}
        <a
          href={MARKETS_SOURCE_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-ink"
        >
          {MARKETS_COPY.tradeAtSource}
        </a>
      </Text>
    </footer>
  );
}
