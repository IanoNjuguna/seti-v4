import { cn } from '@/lib/cn';
import { formatFiat } from '@/lib/formatCurrency';
import { Text } from './Text';
import { TransactionRowSubtitle } from './TransactionRowSubtitle';
import type { TransactionRowBodyProps } from './TransactionRow.types';

/** `12 Oct` — the row's own locale, called after the fetch, never during SSR. */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

/**
 * The row's content, shared by both forms so a transfer reads identically in
 * Activity and on the home card.
 *
 * Money in `font-tabular` (the system's tabular-figure requirement). Inflows use
 * `accent-light-green` — the doc's reserved "success / positive" colour — and
 * outflows stay in `ink`, because a routine payment is not an event worth a
 * colour. Pending uses `accent-yellow` and failed `accent-danger`, each paired
 * with its word so colour is never the only signal.
 *
 * The counterparty address sits UNDER the name it belongs to: a merchant name is
 * something a wallet signed for, while the address is the only part of the pair
 * that cannot be chosen.
 */
export function TransactionRowBody({ transaction, details }: TransactionRowBodyProps) {
  const { merchant, category, amount, currency, date, status, from, to } = transaction;
  const isOutflow = amount < 0;
  const formatted = formatFiat(Math.abs(amount), currency);
  // The subtitle repeats the category only when it adds something: a deposit is
  // titled "Deposit" already, and "Deposit · 10 Oct" under it reads like a stutter.
  const subtitle = category === merchant ? formatDate(date) : `${category} · ${formatDate(date)}`;
  /** The far end of the transfer, when the row knows it. */
  const counterparty = isOutflow ? to : from;

  return (
    <>
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft"
      >
        <Text variant="card-title">{merchant.charAt(0)}</Text>
      </span>

      <span className="min-w-0 flex-1">
        <Text variant="card-title" as="span" className="block">
          {merchant}
        </Text>
        <TransactionRowSubtitle subtitle={subtitle} address={counterparty ?? null} />
        {details}
      </span>

      <span className="flex shrink-0 flex-col items-end">
        <Text
          variant="body-medium"
          tabular
          as="span"
          className={cn(isOutflow ? 'text-ink' : 'text-accent-light-green')}
        >
          {isOutflow ? '-' : '+'}
          {formatted}
        </Text>
        {status !== 'completed' && (
          <Text
            variant="micro"
            as="span"
            className={status === 'pending' ? 'text-accent-yellow' : 'text-accent-danger'}
          >
            {status === 'pending' ? 'Pending' : 'Failed'}
          </Text>
        )}
      </span>
    </>
  );
}
