import { cn } from '@/lib/cn';
import { initialOf, rowGlyph } from './transaction-glyph';
import { formatFiat } from '@/lib/formatCurrency';
import { RowMark } from './RowMark';
import { Text } from './Text';
import { TransactionRowSubtitle } from './TransactionRowSubtitle';
import type { TransactionRowBodyProps } from './TransactionRow.types';

/** `12 Oct` — the row's own locale, called after the fetch, never during SSR. */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

/** `17:22` — a time of day, the second thing every payments app prints under the name (#407). */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * The row's content, shared by both forms so a transfer reads identically in
 * Activity and on the home card.
 *
 * Money in `font-tabular` (the system's tabular-figure requirement). Inflows use
 * `accent-light-green` — the doc's reserved "success / positive" colour — and
 * outflows stay in `ink`, because a routine payment is not an event worth a
 * colour. Pending takes the `progress` role (cyan, in flight) and failed
 * `accent-danger`; each is paired with its word so colour is never the only
 * signal. Yellow is not a state in this app: it is the money button. Every colour here is
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
export function TransactionRowBody({ transaction }: TransactionRowBodyProps) {
  const { merchant, amount, currency, date, status } = transaction;
  const isOutflow = amount < 0;
  const formatted = formatFiat(Math.abs(amount), currency);
  /*
   * THE SECOND LINE IS WHEN, NOT WHAT (#407).
   *
   * `5 Nov · Transfer` named the ledger's own vocabulary under a title that already said what
   * happened. Every consumer payments app puts the time there instead, and it is the fact a person
   * scanning a ledger is actually after: was this today, or last week. The category is still on the
   * row where it earns its place — as the title, when there is no name to use.
   */
  const subtitle = `${formatDate(date)} · ${formatTime(date)}`;
  /** The mark this row wears: its type's glyph, an alert, a clock, or the merchant's initial (#409). */
  const glyph = rowGlyph(transaction);

  return (
    <>
      {/*
        THE CIRCLE CARRIES A GLYPH, NOT A LETTER (#409).

        It used to hold the first letter of the title, so a page of transfers read `S S R S S` — a
        column of letters that were not names. The glyph says what happened; a merchant's initial stays,
        because that one is a name. Money arriving is the only thing tinted. The geometry and the two
        cases live in `RowMark` now (#533), so Home's rows wear the same circle rather than a copy.
      */}
      <RowMark
        icon={glyph.icon}
        initial={glyph.icon ? undefined : initialOf(merchant ?? '')}
        tone={glyph.tone}
      />

      <span className="min-w-0 flex-1">
        <Text variant="card-title" as="span" className="block truncate">
          {merchant}
        </Text>
        <TransactionRowSubtitle subtitle={subtitle} />
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
            color={status === 'pending' ? 'progress' : 'alert'}
          >
            {status === 'pending' ? 'Pending' : 'Failed'}
          </Text>
        )}
      </span>
    </>
  );
}
