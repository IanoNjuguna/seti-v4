'use client';

import { cn } from '@/lib/cn';
import { TransactionRowBody } from './TransactionRowBody';
import type { TransactionRowProps } from './TransactionRow.types';

const ROW_CLASS =
  'flex min-h-16 w-full items-center gap-3 border-b border-hairline-light px-5 py-2.5 text-left';

const SELECTABLE_CLASS =
  'transition-colors duration-200 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';

/**
 * One transaction, in the app's single row shape.
 *
 * A row is a real `<button>` only when it is selectable — a control that does
 * nothing is worse than no control, and the home card's rows open nothing. When
 * it is selectable it keeps full keyboard access because the element is genuinely
 * a button rather than a div wearing an `onClick`, so Enter and Space work and
 * the focus ring is the one the design system specifies.
 */
export function TransactionRow({ transaction, onSelect, details }: TransactionRowProps) {
  if (!onSelect) {
    return (
      <div className={ROW_CLASS}>
        <TransactionRowBody transaction={transaction} details={details} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(transaction)}
      className={cn(ROW_CLASS, SELECTABLE_CLASS)}
    >
      <TransactionRowBody transaction={transaction} details={details} />
    </button>
  );
}
