'use client';

import { TransactionRowBody } from './TransactionRowBody';
import type { TransactionRowProps } from './TransactionRow.types';

const ROW_CLASS =
  'flex min-h-16 w-full items-center gap-3 border-b border-hairline-light px-5 py-2.5 text-left';

/** The row's own control, when the row has one — no padding, so the shell owns it. */
const CONTROL_CLASS =
  'flex min-w-0 flex-1 items-center gap-3 px-5 py-2.5 text-left transition-colors duration-200 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';

/**
 * The same column with no control around it: no hover, no focus ring. Spelled out
 * rather than `cn(CONTROL_CLASS, 'hover:bg-transparent')` because `cn` is a plain
 * join, not `twMerge` — two hover backgrounds in one string are decided by
 * Tailwind's emission order, not by the call.
 */
const STATIC_CLASS = 'flex min-w-0 flex-1 items-center gap-3 px-5 py-2.5 text-left';

/**
 * One transaction, in the app's single row shape.
 *
 * A row is a real `<button>` only when it is selectable — a control that does
 * nothing is worse than no control, and the home card's rows open nothing. When
 * it is selectable it keeps full keyboard access because the element is genuinely
 * a button rather than a div wearing an `onClick`, so Enter and Space work and
 * the focus ring is the one the design system specifies.
 *
 * A row that carries `action` splits into three: a shell that owns the hairline and
 * the row's height, the selectable control inside it, and the action beside it. The
 * action cannot live inside the control — a `<button>` inside a `<button>` is
 * invalid and browsers rebuild the DOM around it — and putting it beside makes "the
 * pill does not open the receipt" a fact about the tree rather than a call to
 * `stopPropagation` that someone can delete.
 *
 * With no action the shape is exactly what it was: one element, same classes, so the
 * home card and every existing row render pixel-identically.
 */
export function TransactionRow({ transaction, onSelect, details, action }: TransactionRowProps) {
  if (!action) {
    if (!onSelect) {
      return (
        <div className={ROW_CLASS}>
          <TransactionRowBody transaction={transaction} details={details} />
        </div>
      );
    }

    return (
      <button type="button" onClick={() => onSelect(transaction)} className={ROW_CLASS}>
        <TransactionRowBody transaction={transaction} details={details} />
      </button>
    );
  }

  return (
    <div className="flex min-h-16 w-full items-center border-b border-hairline-light">
      {onSelect ? (
        <button type="button" onClick={() => onSelect(transaction)} className={CONTROL_CLASS}>
          <TransactionRowBody transaction={transaction} details={details} />
        </button>
      ) : (
        <div className={STATIC_CLASS}>
          <TransactionRowBody transaction={transaction} details={details} />
        </div>
      )}

      <div className="shrink-0 pr-5">{action}</div>
    </div>
  );
}
