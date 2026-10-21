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
 * with its word so colour is never the only signal. Every one of those colours is
 * named through `color=`, never as a bare class the variant could outrank.
 *
 * Layout at 360px: the name column is the ONLY thing allowed to shrink
 * (`flex-1 min-w-0`), and the name itself truncates — a merchant name is long,
 * arbitrary and a label. The money is `shrink-0` and `whitespace-nowrap`, so a
 * long name ellipsises rather than the amount, which must never be the thing that
 * gets cut: it is the row's reason to exist.
 *
 * The counterparty address sits UNDER the name it belongs to: a merchant name is
 * something a wallet signed for, while the address is the only part of the pair
 * that cannot be chosen.
 *
 * A FAILED row is struck through, and the word stays under the amount. The suffix
 * in the meta line (`10 Oct · Payment · Failed`) was the first attempt and it lost:
 * the meta line is the one column allowed to elide at 360px, so the last word of it
 * was the first thing cut — the state disappeared exactly where the row was
 * narrowest. The amount column is `shrink-0` and never truncates, so the word goes
 * there beside the struck figure: two signals in the one place on the row that
 * cannot be clipped.
 */
export function TransactionRowBody({ transaction, details }: TransactionRowBodyProps) {
  const { merchant, category, amount, currency, date, status, from, to } = transaction;
  const isOutflow = amount < 0;
  const formatted = formatFiat(Math.abs(amount), currency);
  /**
   * The subtitle repeats the category only when it adds something: a deposit is
   * titled "Deposit" already, and "Deposit · 10 Oct" under it reads like a stutter.
   *
   * DATE FIRST, and that is a hierarchy decision rather than a style one. The
   * content column is 104px at 360px, so this line elides — and an elided date
   * reads as broken ("14 Oc…") while an elided category reads as a label doing its
   * job ("Food & dr…"). On a ledger the date is the fact and the category is the
   * label, which is the same rule this row already applies to the name (a label)
   * and the address under it (a fact).
   */
  const subtitle = category === merchant ? formatDate(date) : `${formatDate(date)} · ${category}`;
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
        <Text variant="card-title" as="span" className="block truncate">
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
          color={isOutflow ? 'primary' : 'success'}
          className={cn('shrink-0 whitespace-nowrap', status === 'failed' && 'line-through')}
        >
          {isOutflow ? '-' : '+'}
          {formatted}
        </Text>
        {status !== 'completed' && (
          <Text
            variant="micro"
            as="span"
            color={status === 'pending' ? 'warning' : 'alert'}
          >
            {status === 'pending' ? 'Pending' : 'Failed'}
          </Text>
        )}
      </span>
    </>
  );
}
