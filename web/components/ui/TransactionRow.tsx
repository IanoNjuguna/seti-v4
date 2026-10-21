'use client';

import { cn } from '@/lib/cn';
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
 * The strip the action sits in, under the row's content.
 *
 * `left-[4.5rem]` is `px-5` (20px) + the 40px avatar + `gap-3` (12px): the action
 * lines up with the NAME column, not with the row's edge, because it acts on the
 * person named there. Reserved with padding rather than measured, so the row's
 * height includes it and the hairline stays where the last row's does.
 */
const ACTION_CLASS = 'absolute bottom-2 left-[4.5rem]';
const ACTION_RESERVE_CLASS = 'pb-12';

/**
 * One transaction, in the app's single row shape.
 *
 * A row is a real `<button>` only when it is selectable — a control that does
 * nothing is worse than no control, and the home card's rows open nothing. When
 * it is selectable it keeps full keyboard access because the element is genuinely
 * a button rather than a div wearing an `onClick`, so Enter and Space work and
 * the focus ring is the one the design system specifies.
 *
 * A row that carries `action` keeps that button and lays the action OVER the
 * reserved strip at the bottom, never inside it: a `<button>` inside a `<button>` is
 * invalid and browsers rebuild the DOM around it. Positioned rather than placed in
 * the flex row because the action belongs under the payee — measured at 360px, an
 * action at the row's trailing edge squeezed the content column until the amount
 * itself was clipped, which is the one thing this row says must never happen.
 *
 * With no action the shape is exactly what it was: one element, the same classes, so
 * the home card and every existing row render pixel-identically.
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
    <div className="relative flex min-h-16 w-full items-stretch border-b border-hairline-light">
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(transaction)}
          className={cn(CONTROL_CLASS, ACTION_RESERVE_CLASS, 'w-full')}
        >
          <TransactionRowBody transaction={transaction} details={details} />
        </button>
      ) : (
        <div className={cn(STATIC_CLASS, ACTION_RESERVE_CLASS, 'w-full')}>
          <TransactionRowBody transaction={transaction} details={details} />
        </div>
      )}

      <div className={ACTION_CLASS}>{action}</div>
    </div>
  );
}
