'use client';

import { useEffect } from 'react';
import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PAY_AMOUNT_COPY, PAY_FIGURE_CLASS, PAY_KEYPAD_KEYS } from './Pay.constants';
import { applyKey } from './pay-keypad';

export interface PayKeypadProps {
  id: string;
  /** The amount as it is typed, in the customer's own currency. */
  amount: string;
  disabled: boolean;
  onAmount: (next: string) => void;
}

/**
 * The keypad the amount is typed on.
 *
 * Every payment app in the reference set puts a keypad under the figure: Satispay's merchant
 * screen is a big `10 €`, a balance line and a grid of digits with `Pay Now` above it (#440). A
 * labelled text input is a form, and paying somebody is not filling one in.
 *
 * It writes through `applyKey`, which is a pure function of the current string and the key, so the
 * field and the keypad cannot disagree about what was typed, and the arithmetic is testable
 * without a DOM.
 *
 * `type="button"` on every key: inside a form these would submit it, which is how a decimal point
 * becomes a payment.
 *
 * No key is a control with a fill at rest. The grid is text on the page, and the only state a key
 * has is pressed: a 3x4 block of `surface-soft` squares would be the loudest object on a screen
 * whose subject is a number.
 */
export function PayKeypad({ id, amount, disabled, onAmount }: PayKeypadProps) {
  // The keypad is a view of the field: while an amount is typed on it, the field keeps the
  // cursor, so a customer on a keyboard and a customer on a thumb are editing the same thing.
  useEffect(() => {
    if (disabled) return;
    const field = document.getElementById(id);
    if (field instanceof HTMLInputElement && document.activeElement !== field) field.focus();
  }, [id, amount, disabled]);

  return (
    <div className="grid grid-cols-3 gap-1" role="group" aria-label={PAY_AMOUNT_COPY.keypadLabel}>
      {PAY_KEYPAD_KEYS.map((key) => (
        <button
          key={key.label}
          type="button"
          disabled={disabled}
          aria-label={key.label === '⌫' ? PAY_AMOUNT_COPY.backspace : undefined}
          onClick={() => onAmount(applyKey(amount, key.value))}
          className={cn(
            'flex h-14 items-center justify-center rounded-md font-mono font-tabular text-heading-sm text-ink',
            'transition-colors duration-100 active:bg-surface-soft disabled:opacity-40',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            key.muted && 'text-mute'
          )}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}

export interface PayAmountFigureProps {
  id: string;
  /** The amount as typed. Empty until the first key. */
  amount: string;
  /** The quote's currency. Empty until a quote exists, and then the unit is not printed. */
  currency: string;
  error?: string;
  disabled: boolean;
  onAmount: (next: string) => void;
}

/**
 * The amount, at the size the screen is about.
 *
 * This is the change that makes the step read as a payment rather than a form (#440): the figure
 * is the largest thing on the surface, the currency sits beside it as a unit rather than a label
 * above a box, and there is no border anywhere near it.
 *
 * It stays a real `<input inputMode="decimal">`: on a laptop the keyboard IS the keypad, and a
 * figure that looks typed but cannot be typed is a lie about the one thing the customer must
 * enter. Both entries write through the same `onAmount`.
 */
export function PayAmountFigure({
  id,
  amount,
  currency,
  error,
  disabled,
  onAmount,
}: PayAmountFigureProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {PAY_AMOUNT_COPY.amountLabel}
      </label>

      <div className="flex items-baseline gap-2">
        {currency ? (
          <Text variant="body" as="span" className="shrink-0 font-semibold">
            {currency}
          </Text>
        ) : null}
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amount}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onAmount(event.target.value)}
          className={cn(PAY_FIGURE_CLASS, error && 'text-alert')}
        />
      </div>

      {error ? (
        <Text variant="micro" as="p" color="alert" id={errorId}>
          {error}
        </Text>
      ) : null}
    </div>
  );
}
