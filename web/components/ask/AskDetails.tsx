'use client';

import { useState } from 'react';
import { Input, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ASK_COPY } from './ask.constants';
import type { AskDetailsProps } from './ask.types';

/**
 * The two optional answers, behind one row (#483).
 *
 * The reference set for asking somebody for money is: amount, ONE optional message, share. This had
 * three blocks under the keypad, a note field, a name picker and an expiry row, which pushed the only
 * control that does anything to the bottom of a scrolling screen.
 *
 * So the options open on a tap, and the closed line says what has been CHOSEN rather than what is
 * missing ("Rent · 7 days"), which is the rule the rest of this app follows: a closed control still
 * answers the question.
 *
 * The payee stays visible whenever there is a choice to make. Which name a claim is paid to is not an
 * option about the figure, it is whose money it is, and hiding an identity behind a disclosure would
 * be the one thing here a customer must never have to go looking for.
 */
export function AskDetails({
  memo,
  expiresInDays,
  disabled,
  payees,
  payee,
  onMemo,
  onExpiry,
  onPayee,
}: AskDetailsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {payees.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Text variant="micro" as="span" color="secondary">
            {ASK_COPY.payeeLabel}
          </Text>
          {payees.map((option) => (
            <Chip
              key={option.handle}
              label={option.name}
              selected={option.handle === payee}
              disabled={disabled}
              onSelect={() => onPayee(option.handle)}
            />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-3 border-b border-hairline-light pb-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light disabled:opacity-40"
      >
        <Text variant="micro" as="span" color="secondary">
          {summary(memo, expiresInDays)}
        </Text>
        <Text variant="micro" as="span" color="secondary">
          {open ? ASK_COPY.extrasClose : ASK_COPY.extrasOpen}
        </Text>
      </button>

      {open ? (
        <div className="flex flex-col gap-3">
          <Input
            label={ASK_COPY.memoLabel}
            placeholder={ASK_COPY.memoPlaceholder}
            value={memo}
            maxLength={200}
            disabled={disabled}
            onChange={(event) => onMemo(event.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            {ASK_COPY.expiryOptions.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                selected={option.days === expiresInDays}
                disabled={disabled}
                onSelect={() => onExpiry(option.days)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** What has been chosen, in the customer's words, or an invitation when nothing has. */
function summary(memo: string, expiresInDays: number | null): string {
  const chosen = ASK_COPY.expiryOptions.find((option) => option.days === expiresInDays);
  const parts = [memo.trim(), chosen?.label].filter((part) => part !== undefined && part.length > 0);

  return parts.length > 0 ? parts.join(' · ') : ASK_COPY.extrasEmpty;
}

interface ChipProps {
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

/** A 44px choice. Selected is a surface change plus an ink change, never colour alone. */
function Chip({ label, selected, disabled, onSelect }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 items-center rounded-md border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light disabled:opacity-40',
        selected ? 'border-ink bg-surface-soft' : 'border-hairline-light hover:border-hairline-strong'
      )}
    >
      <Text variant="micro" as="span" color={selected ? 'primary' : 'secondary'}>
        {label}
      </Text>
    </button>
  );
}
